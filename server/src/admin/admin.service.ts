// server/src/admin/admin.service.ts
// The admin overview (how SpeakBetter is doing, at a glance) and system health (is everything it depends on up,
// and which optional services are switched on).

import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';
import { REDIS_CLIENT } from '../common/redis.module';
import { AdminReportsService } from './admin-reports.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;
const CHECK_TIMEOUT_MS = 2000;

/** Plain names for what each kind of XP says someone did */
const FEATURE_NAMES: Record<string, string> = {
  VOICE_SPEAKING: 'Speaking in rooms',
  FLASHCARD_REVIEW: 'Flashcard reviews',
  PRONUNCIATION_PRACTICE: 'Pronunciation',
  AI_PRACTICE: 'AI partner',
  CORRECTION_GIVEN: 'Corrections given',
  CORRECTION_ACCEPTED: 'Corrections learned',
  CHAT_MESSAGE: 'Chat',
  EXERCISE_COMPLETED: 'Grammar & exercises',
  VOCABULARY_MASTERED: 'Word packs',
  WRITING_PRACTICE: 'Writing',
  CHALLENGE_COMPLETED: 'Daily challenge',
  QUEST_COMPLETED: 'Weekly quests',
  DAILY_PLAN: 'Daily plan',
  LESSON_COMPLETED: 'Lessons (library, role-play, shadowing)',
  QUIZ_COMPLETED: 'Quizzes',
  VOCAB_TEST: 'Vocabulary test',
  MISSION_COMPLETED: 'Room missions',
  STREAK_REWARD: 'Streak rewards',
  DAILY_LOGIN: 'Daily sign-in',
  BONUS: 'Bonuses',
};

/** The optional services and keys worth knowing about (only whether each is set, never its value) */
const OPTIONAL_SETTINGS: Array<{ key: string; what: string }> = [
  { key: 'ANTHROPIC_API_KEY', what: 'AI speaking partner (Claude)' },
  { key: 'DEEPGRAM_API_KEY', what: 'Live captions in voice rooms' },
  { key: 'OPENAI_API_KEY', what: 'Paid translation of transcripts' },
  { key: 'LANGUAGETOOL_URL', what: 'Own grammar checker (else the free public one)' },
  { key: 'VAPID_PUBLIC_KEY', what: 'Push notifications' },
  { key: 'LIVEKIT_API_KEY', what: 'Voice rooms (LiveKit)' },
  { key: 'GOOGLE_CLIENT_ID', what: 'Sign in with Google' },
  { key: 'CLOUDINARY_CLOUD_NAME', what: 'Uploads (images, voice messages)' },
  { key: 'REALTIME_REDIS_URL', what: 'Running more than one server' },
  { key: 'ADMIN_EMAILS', what: 'First admins' },
  { key: 'BILLING_ALLOW_SANDBOX', what: 'Test payments in production' },
];

type Health = { name: string; ok: boolean | null; ms: number | null; note: string };

const withTimeout = <T>(work: Promise<T>, ms = CHECK_TIMEOUT_MS) =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

@Injectable()
export class AdminService {
  private readonly started = Date.now();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private reports: AdminReportsService,
    @Optional() @Inject(REDIS_CLIENT) private redis?: Redis | null,
  ) {}

  async overview() {
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const activePro = { plan: 'PRO' as const, status: { in: ['ACTIVE' as const, 'TRIALING' as const] }, OR: [{ endDate: null }, { endDate: { gt: now } }] };

    const [
      users,
      newToday,
      new7,
      new30,
      activeToday,
      active7,
      active30,
      suspended,
      staff,
      liveRooms,
      peopleInRooms,
      pro,
      revenue30,
      reportCounts,
      signups,
      learners,
      features,
      latestUsers,
      communities,
      hiddenCommunities,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: ago(7) } } }),
      this.prisma.user.count({ where: { createdAt: { gte: ago(30) } } }),
      this.prisma.profile.count({ where: { lastActive: { gte: today } } }),
      this.prisma.profile.count({ where: { lastActive: { gte: ago(7) } } }),
      this.prisma.profile.count({ where: { lastActive: { gte: ago(30) } } }),
      this.prisma.user.count({ where: { suspendedUntil: { gt: now } } }),
      this.prisma.user.count({ where: { role: { in: ['MODERATOR', 'ADMIN'] } } }),
      this.prisma.voiceRoom.count({ where: { status: { in: ['WAITING', 'ACTIVE'] } } }),
      this.prisma.voiceParticipant.count({ where: { leftAt: null, room: { status: { in: ['WAITING', 'ACTIVE'] } } } }),
      this.prisma.subscription.count({ where: activePro }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: ago(30) } }, _sum: { amount: true } }),
      this.reports.counts(),
      this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS n
        FROM "User" WHERE "createdAt" >= ${ago(SERIES_DAYS - 1)}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(DISTINCT "userId") AS n
        FROM "XpTransaction" WHERE "createdAt" >= ${ago(SERIES_DAYS - 1)}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.xpTransaction.groupBy({
        by: ['reason'],
        where: { createdAt: { gte: ago(7) } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
      }),
      this.prisma.community.count(),
      this.prisma.community.count({ where: { hiddenAt: { not: null } } }),
    ]);

    // Day-by-day series with the empty days filled in (dates in the server's local calendar)
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const series = (rows: Array<{ day: Date; n: bigint }>) => {
      const byDay = new Map(rows.map((r) => [key(new Date(r.day)), Number(r.n)]));
      return Array.from({ length: SERIES_DAYS }, (_, i) => {
        const d = new Date(today.getTime() - (SERIES_DAYS - 1 - i) * DAY_MS);
        return { day: key(d), value: byDay.get(key(d)) ?? 0 };
      });
    };

    return {
      users: { total: users, newToday, new7, new30, suspended, staff },
      active: { today: activeToday, week: active7, month: active30 },
      rooms: { live: liveRooms, people: peopleInRooms },
      communities: { total: communities, hidden: hiddenCommunities },
      pro: { active: pro, revenue30: revenue30._sum.amount ?? 0 },
      reports: reportCounts,
      signups: series(signups),
      learners: series(learners),
      features: features
        .map((f) => ({ reason: f.reason, name: FEATURE_NAMES[f.reason] ?? f.reason, actions: f._count._all, xp: f._sum.amount ?? 0 }))
        .sort((a, b) => b.actions - a.actions),
      latestUsers,
    };
  }

  async system() {
    const checks = await Promise.all([this.checkDatabase(), this.checkRedis(), this.checkSearch(), this.checkLiveKit()]);
    const [users, messages, reviews, xp, notifications, audit] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.message.count(),
      this.prisma.reviewLog.count(),
      this.prisma.xpTransaction.count(),
      this.prisma.notification.count(),
      this.prisma.adminAuditLog.count(),
    ]);
    const memory = process.memoryUsage();
    return {
      checks,
      settings: OPTIONAL_SETTINGS.map((s) => ({ ...s, set: Boolean(this.config.get<string>(s.key)) })),
      server: {
        environment: this.config.get<string>('NODE_ENV') || 'development',
        node: process.version,
        uptimeSeconds: Math.round((Date.now() - this.started) / 1000),
        memoryMb: Math.round(memory.rss / 1e6),
        heapMb: Math.round(memory.heapUsed / 1e6),
      },
      tables: { users, messages, reviews, xp, notifications, audit },
    };
  }

  private async timed(name: string, work: () => Promise<string>): Promise<Health> {
    const start = Date.now();
    try {
      const note = await withTimeout(work());
      return { name, ok: true, ms: Date.now() - start, note };
    } catch (error) {
      const reason = (error as Error)?.message || '';
      return { name, ok: false, ms: Date.now() - start, note: reason === 'timed out' ? 'Not answering (timed out)' : `Not reachable${reason ? ` (${reason})` : ''}` };
    }
  }

  private checkDatabase() {
    return this.timed('Database (PostgreSQL)', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'Connected';
    });
  }

  private async checkRedis(): Promise<Health> {
    if (this.redis) {
      return this.timed('Redis', async () => `${await this.redis!.ping()} (shared real-time state)`);
    }
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return { name: 'Redis', ok: null, ms: null, note: 'Not configured' };
    return this.timed('Redis', async () => {
      const client = new Redis(url, { lazyConnect: true, connectTimeout: CHECK_TIMEOUT_MS, maxRetriesPerRequest: 0, retryStrategy: () => null });
      try {
        await client.connect();
        return await client.ping();
      } finally {
        client.disconnect();
      }
    });
  }

  private async checkSearch(): Promise<Health> {
    const host = this.config.get<string>('MEILISEARCH_HOST');
    if (!host) return { name: 'Search (Meilisearch)', ok: null, ms: null, note: 'Not configured' };
    return this.timed('Search (Meilisearch)', async () => {
      const response = await fetch(new URL('/health', host));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return 'Available';
    });
  }

  private async checkLiveKit(): Promise<Health> {
    const host = this.config.get<string>('LIVEKIT_HTTP_URL') || this.config.get<string>('LIVEKIT_HOST');
    if (!host) return { name: 'Voice server (LiveKit)', ok: null, ms: null, note: 'Not configured' };
    return this.timed('Voice server (LiveKit)', async () => {
      // Any answer means it is up; the API itself needs signed requests
      await fetch(host.replace(/^ws/, 'http'));
      return 'Reachable';
    });
  }
}
