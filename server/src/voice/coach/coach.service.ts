// server/src/voice/coach/coach.service.ts
// The room coach: live fluency feedback, secret-word missions, airtime balance,
// topic-card spotlights and saved session reports.
//
// State lives in memory for the life of a room (like the gateway's other room state);
// each learner's results are saved to VoiceSessionReport whenever they leave.

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ActivityService } from '../../learning/activity.service';
import {
  MISSION_POINTS,
  MISSION_SPEED_BONUS,
  TOPIC_CARDS,
  type CefrLevel,
  type MissionWord,
  type TopicCard,
} from './coach.data';
import {
  FluencyTracker,
  buildAirtime,
  coachTip,
  matchesMissionWord,
  missionPoints,
  normalizeLevel,
  pickMissionWord,
  pickQuietest,
  pickTopicCard,
  type AirtimeSnapshot,
  type CoachTip,
  type FluencySnapshot,
  type Rng,
} from './coach.engine';

/** Most XP one learner can earn from missions per day (keeps it about practice, not farming) */
export const MISSION_XP_DAILY_CAP = 60;
const MIN_MISSION_SECONDS = 60;
const MAX_MISSION_SECONDS = 20 * 60;
const DEFAULT_MISSION_SECONDS = 5 * 60;
const MIN_TIP_GAP_MS = 20_000;
const SEEN_UTTERANCES = 40;

interface UserState {
  name: string;
  tracker: FluencyTracker;
  speakingSec: number;
  joinedAt: number | null;
  /** Time in the room from earlier visits */
  durationSec: number;
  missionsCompleted: number;
  missionXp: number;
  missionWords: string[];
  lastTipAt: number;
  seenUtterances: string[];
}

interface Assignment {
  entry: MissionWord;
  swapped: boolean;
  completedAt?: number;
  place?: number;
  points?: number;
}

interface MissionState {
  level: CefrLevel;
  startedAt: number;
  endsAt: number;
  startedBy: string;
  assignments: Map<string, Assignment>;
  finishOrder: string[];
  timer?: NodeJS.Timeout;
}

interface RoomState {
  users: Map<string, UserState>;
  mission: MissionState | null;
  usedCards: Set<string>;
  /** speaking seconds per user for the airtime bars */
  airtimeSec: Record<string, number>;
}

export interface MissionPublicView {
  level: CefrLevel;
  startedAt: number;
  endsAt: number;
  startedBy: string;
  total: number;
  completed: { userId: string; userName: string; word: string; points: number; place: number }[];
}

export interface MissionPrivateView {
  word: string;
  meaning: string;
  example: string;
  level: CefrLevel;
  swapped: boolean;
  completed: boolean;
  points: number | null;
}

export interface MissionCompletion {
  userId: string;
  userName: string;
  word: string;
  meaning: string;
  points: number;
  place: number;
  total: number;
}

export interface MissionResult {
  level: CefrLevel;
  reason: 'stopped' | 'timeout';
  /** Words are revealed now that the round is over */
  results: {
    userId: string;
    userName: string;
    word: string;
    meaning: string;
    completed: boolean;
    points: number;
    place: number | null;
  }[];
}

export interface LiveCoach {
  snapshot: FluencySnapshot;
  tip: CoachTip | null;
}

type MissionEndListener = (roomId: string, result: MissionResult) => void;

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private rooms = new Map<string, RoomState>();
  private missionEndListener?: MissionEndListener;

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  /** The gateway registers here to announce rounds that end by timer */
  onMissionEnd(listener: MissionEndListener) {
    this.missionEndListener = listener;
  }

  // ------------------------------------------------------------------
  // Room and user state
  // ------------------------------------------------------------------

  private room(roomId: string): RoomState {
    let state = this.rooms.get(roomId);
    if (!state) {
      state = { users: new Map(), mission: null, usedCards: new Set(), airtimeSec: {} };
      this.rooms.set(roomId, state);
    }
    return state;
  }

  private user(roomId: string, userId: string, name = 'Learner'): UserState {
    const room = this.room(roomId);
    let u = room.users.get(userId);
    if (!u) {
      u = {
        name,
        tracker: new FluencyTracker(),
        speakingSec: 0,
        joinedAt: null,
        durationSec: 0,
        missionsCompleted: 0,
        missionXp: 0,
        missionWords: [],
        lastTipAt: 0,
        seenUtterances: [],
      };
      room.users.set(userId, u);
    }
    if (name !== 'Learner') u.name = name;
    return u;
  }

  /** True once the person has been seen in this room (used to ignore events from strangers) */
  hasUser(roomId: string, userId: string) {
    return Boolean(this.rooms.get(roomId)?.users.get(userId));
  }

  join(roomId: string, userId: string, name: string) {
    const u = this.user(roomId, userId, name);
    if (u.joinedAt === null) u.joinedAt = Date.now();
  }

  noteSpeaking(roomId: string, userId: string, seconds: number) {
    if (!(seconds > 0)) return;
    const u = this.user(roomId, userId);
    u.speakingSec += seconds;
    const room = this.room(roomId);
    room.airtimeSec[userId] = (room.airtimeSec[userId] ?? 0) + seconds;
  }

  // ------------------------------------------------------------------
  // Live coaching + missions, driven by what people say
  // ------------------------------------------------------------------

  /**
   * Takes a finished caption line. Updates the speaker's fluency and checks their mission.
   * `utteranceId` stops the same line being counted twice.
   */
  async onFinalUtterance(
    roomId: string,
    userId: string,
    text: string,
    utteranceId?: string,
  ): Promise<{ live: LiveCoach | null; completion: MissionCompletion | null }> {
    const u = this.user(roomId, userId);

    if (utteranceId) {
      if (u.seenUtterances.includes(utteranceId)) return { live: null, completion: null };
      u.seenUtterances.push(utteranceId);
      if (u.seenUtterances.length > SEEN_UTTERANCES) u.seenUtterances.shift();
    }

    u.tracker.add(text);
    const snapshot = u.tracker.snapshot(u.speakingSec);

    let tip: CoachTip | null = null;
    const now = Date.now();
    if (now - u.lastTipAt >= MIN_TIP_GAP_MS) {
      tip = coachTip(snapshot);
      if (tip) u.lastTipAt = now;
    }

    const completion = await this.checkMission(roomId, userId, text);
    return { live: { snapshot, tip }, completion };
  }

  getLive(roomId: string, userId: string): LiveCoach {
    const u = this.user(roomId, userId);
    return { snapshot: u.tracker.snapshot(u.speakingSec), tip: null };
  }

  // ------------------------------------------------------------------
  // Missions
  // ------------------------------------------------------------------

  isMissionActive(roomId: string) {
    return Boolean(this.rooms.get(roomId)?.mission);
  }

  /** Starts a round: every person in `people` gets their own secret word */
  startMission(
    roomId: string,
    opts: { level?: unknown; durationSec?: unknown; startedBy: string },
    people: { userId: string; name: string }[],
    rng: Rng = Math.random,
  ): MissionPublicView {
    const room = this.room(roomId);
    if (room.mission) throw new Error('A mission round is already running');
    if (people.length === 0) throw new Error('Nobody is in the room');

    const level = normalizeLevel(opts.level);
    const durationSec = Math.round(
      Math.min(MAX_MISSION_SECONDS, Math.max(MIN_MISSION_SECONDS, Number(opts.durationSec) || DEFAULT_MISSION_SECONDS)),
    );
    const now = Date.now();
    const mission: MissionState = {
      level,
      startedAt: now,
      endsAt: now + durationSec * 1000,
      startedBy: opts.startedBy,
      assignments: new Map(),
      finishOrder: [],
    };
    room.mission = mission;

    const taken = new Set<string>();
    for (const p of people) {
      this.user(roomId, p.userId, p.name);
      const entry = pickMissionWord(level, taken, rng);
      taken.add(entry.word);
      mission.assignments.set(p.userId, { entry, swapped: false });
    }

    mission.timer = setTimeout(() => {
      const result = this.stopMission(roomId, 'timeout');
      if (result) this.missionEndListener?.(roomId, result);
    }, durationSec * 1000);
    // Never keep the process alive just for a mission timer
    mission.timer.unref?.();

    return this.missionPublic(roomId)!;
  }

  /** Someone joins while a round is running: they get a word too */
  assignLate(roomId: string, userId: string, name: string, rng: Rng = Math.random): MissionPrivateView | null {
    const mission = this.rooms.get(roomId)?.mission;
    if (!mission) return null;
    this.user(roomId, userId, name);
    if (!mission.assignments.has(userId)) {
      const taken = new Set([...mission.assignments.values()].map((a) => a.entry.word));
      mission.assignments.set(userId, { entry: pickMissionWord(mission.level, taken, rng), swapped: false });
    }
    return this.missionPrivate(roomId, userId);
  }

  /** One free swap per round, only until the word has been used */
  swapWord(roomId: string, userId: string, rng: Rng = Math.random): MissionPrivateView {
    const mission = this.rooms.get(roomId)?.mission;
    const mine = mission?.assignments.get(userId);
    if (!mission || !mine) throw new Error('You have no mission word right now');
    if (mine.completedAt) throw new Error('You already completed your mission');
    if (mine.swapped) throw new Error('You already swapped your word this round');

    const taken = new Set([...mission.assignments.values()].map((a) => a.entry.word));
    mine.entry = pickMissionWord(mission.level, taken, rng);
    mine.swapped = true;
    return this.missionPrivate(roomId, userId)!;
  }

  stopMission(roomId: string, reason: 'stopped' | 'timeout' = 'stopped'): MissionResult | null {
    const room = this.rooms.get(roomId);
    const mission = room?.mission;
    if (!room || !mission) return null;

    if (mission.timer) clearTimeout(mission.timer);
    room.mission = null;

    const results = [...mission.assignments.entries()]
      .map(([userId, a]) => ({
        userId,
        userName: room.users.get(userId)?.name ?? 'Learner',
        word: a.entry.word,
        meaning: a.entry.meaning,
        completed: Boolean(a.completedAt),
        points: a.points ?? 0,
        place: a.place ?? null,
      }))
      .sort((x, y) => y.points - x.points || (x.place ?? 99) - (y.place ?? 99));

    return { level: mission.level, reason, results };
  }

  missionPublic(roomId: string): MissionPublicView | null {
    const room = this.rooms.get(roomId);
    const mission = room?.mission;
    if (!room || !mission) return null;
    return {
      level: mission.level,
      startedAt: mission.startedAt,
      endsAt: mission.endsAt,
      startedBy: mission.startedBy,
      total: mission.assignments.size,
      completed: mission.finishOrder.map((userId, i) => {
        const a = mission.assignments.get(userId)!;
        return {
          userId,
          userName: room.users.get(userId)?.name ?? 'Learner',
          word: a.entry.word,
          points: a.points ?? 0,
          place: i + 1,
        };
      }),
    };
  }

  missionPrivate(roomId: string, userId: string): MissionPrivateView | null {
    const mission = this.rooms.get(roomId)?.mission;
    const a = mission?.assignments.get(userId);
    if (!mission || !a) return null;
    return {
      word: a.entry.word,
      meaning: a.entry.meaning,
      example: a.entry.example,
      level: a.entry.level,
      swapped: a.swapped,
      completed: Boolean(a.completedAt),
      points: a.points ?? null,
    };
  }

  private async checkMission(roomId: string, userId: string, text: string): Promise<MissionCompletion | null> {
    const room = this.rooms.get(roomId);
    const mission = room?.mission;
    const mine = mission?.assignments.get(userId);
    if (!room || !mission || !mine || mine.completedAt) return null;
    if (!matchesMissionWord(mine.entry, text)) return null;

    const place = mission.finishOrder.length;
    const points = missionPoints(MISSION_POINTS[mission.level], place, MISSION_SPEED_BONUS);
    mine.completedAt = Date.now();
    mine.place = place + 1;
    mine.points = points;
    mission.finishOrder.push(userId);

    const u = this.user(roomId, userId);
    u.missionsCompleted++;
    u.missionXp += points;
    u.missionWords.push(mine.entry.word);

    await this.activity.recordCappedActivity(userId, points, 'MISSION_COMPLETED', MISSION_XP_DAILY_CAP);

    return {
      userId,
      userName: u.name,
      word: mine.entry.word,
      meaning: mine.entry.meaning,
      points,
      place: place + 1,
      total: mission.assignments.size,
    };
  }

  // ------------------------------------------------------------------
  // Airtime and spotlight
  // ------------------------------------------------------------------

  /** Who is in the room and could be speaking (listeners in stage rooms are left out) */
  async airtimePeople(roomId: string): Promise<{ userId: string; name: string }[]> {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { type: true, creatorId: true },
    });
    if (!room) return [];
    const participants = await this.prisma.voiceParticipant.findMany({
      where: { roomId, leftAt: null },
      select: { userId: true, role: true, user: { select: { name: true } } },
    });
    return participants
      .filter(
        (p) =>
          room.type !== 'STAGE' ||
          p.userId === room.creatorId ||
          ['MODERATOR', 'SPEAKER', 'STAGE_SPEAKER'].includes(p.role),
      )
      .map((p) => ({ userId: p.userId, name: p.user?.name ?? 'Learner' }));
  }

  async airtime(roomId: string): Promise<AirtimeSnapshot> {
    const people = await this.airtimePeople(roomId);
    return buildAirtime(people, this.rooms.get(roomId)?.airtimeSec ?? {});
  }

  /** Picks the person (default: whoever has spoken least) and a topic card for them */
  async spotlight(
    roomId: string,
    opts: { targetUserId?: string; cardId?: string; level?: unknown; category?: TopicCard['category'] },
    rng: Rng = Math.random,
  ): Promise<{ target: { userId: string; name: string } | null; card: TopicCard }> {
    const room = this.room(roomId);
    const people = await this.airtimePeople(roomId);

    let target: { userId: string; name: string } | null = null;
    if (opts.targetUserId) {
      target = people.find((p) => p.userId === opts.targetUserId) ?? null;
      if (!target) throw new Error('That person is not on the speaking list');
    } else if (people.length > 0) {
      const quietest = pickQuietest(buildAirtime(people, room.airtimeSec), rng);
      if (quietest) target = { userId: quietest.userId, name: quietest.name };
    }

    let chosen: TopicCard | undefined;
    if (opts.cardId) {
      chosen = TOPIC_CARDS.find((c) => c.id === opts.cardId);
      if (!chosen) throw new Error('That topic card does not exist');
    } else {
      const level = opts.level ? normalizeLevel(opts.level) : (room.mission?.level ?? null);
      chosen = pickTopicCard({ level, category: opts.category, exclude: room.usedCards }, rng);
    }
    room.usedCards.add(chosen.id);
    return { target, card: chosen };
  }

  // ------------------------------------------------------------------
  // Session reports
  // ------------------------------------------------------------------

  /** Saves the person's results so far; safe to call every time they leave */
  async leave(roomId: string, userId: string) {
    const u = this.rooms.get(roomId)?.users.get(userId);
    if (!u) return null;
    if (u.joinedAt !== null) {
      u.durationSec += Math.round((Date.now() - u.joinedAt) / 1000);
      u.joinedAt = null;
    }
    return this.saveReport(roomId, userId, u);
  }

  /** Everyone has gone: save anyone still open and free the memory */
  async closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.mission?.timer) clearTimeout(room.mission.timer);
    this.rooms.delete(roomId);
    for (const [userId, u] of room.users) {
      if (u.joinedAt !== null) {
        u.durationSec += Math.round((Date.now() - u.joinedAt) / 1000);
        u.joinedAt = null;
        await this.saveReport(roomId, userId, u);
      }
    }
  }

  private async saveReport(roomId: string, userId: string, u: UserState) {
    const snap = u.tracker.snapshot(u.speakingSec);
    // A quick peek into a room isn't a session worth keeping
    if (snap.words === 0 && u.speakingSec < 1 && u.durationSec < 30 && u.missionsCompleted === 0) return null;

    try {
      const [room, received, given] = await Promise.all([
        this.prisma.voiceRoom.findUnique({ where: { id: roomId }, select: { name: true } }),
        this.prisma.voiceCorrection.count({ where: { roomId, targetUserId: userId } }),
        this.prisma.voiceCorrection.count({ where: { roomId, authorId: userId } }),
      ]);
      if (!room) return null;

      const data = {
        roomName: room.name,
        durationSec: u.durationSec,
        speakingSec: Math.round(u.speakingSec),
        words: snap.words,
        uniqueWords: snap.uniqueWords,
        fillerCount: snap.fillerCount,
        repeatCount: snap.repeats,
        wpm: snap.wpm,
        fluencyScore: snap.fluency,
        missionsCompleted: u.missionsCompleted,
        missionXp: u.missionXp,
        correctionsReceived: received,
        correctionsGiven: given,
        topFillers: snap.topFillers as unknown as Prisma.InputJsonValue,
        missionWords: u.missionWords,
        richWords: snap.richWords,
      };
      return await this.prisma.voiceSessionReport.upsert({
        where: { roomId_userId: { roomId, userId } },
        create: { roomId, userId, ...data },
        update: data,
      });
    } catch (error) {
      this.logger.warn(`Could not save session report for ${userId} in ${roomId}: ${error?.message}`);
      return null;
    }
  }

  getMyReports(userId: string, limit = 20) {
    return this.prisma.voiceSessionReport.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(Math.floor(limit) || 20, 1), 50),
    });
  }

  getRoomReport(roomId: string, userId: string) {
    return this.prisma.voiceSessionReport.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
  }
}
