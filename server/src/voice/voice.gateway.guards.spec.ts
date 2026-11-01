import { ForbiddenException } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { VoiceChatGateway } from './realtime/voice-chat.gateway';
import { VoiceCoachGateway } from './realtime/voice-coach.gateway';
import { VoiceModerationGateway } from './realtime/voice-moderation.gateway';
import { VoiceBroadcaster } from './realtime/voice-broadcaster';
import { VoiceCoachSession } from './realtime/voice-coach-session';
import { VoiceRoomState } from './realtime/voice-room-state';

/**
 * What a client emits "into" a room must come from a socket that joined that
 * room. The room name is only a string the client picks.
 */
const makeGateway = (
  prismaOverrides: any = {},
  voiceServiceOverrides: any = {},
) => {
  const emitted: Array<{ room: string; event: string; payload: any }> = [];
  const server: any = {
    to: (room: string) => ({
      emit: (event: string, payload: any) =>
        emitted.push({ room, event, payload }),
    }),
  };
  const coach: any = {
    onMissionEnd: jest.fn(),
    noteSpeaking: jest.fn(),
    onFinalUtterance: jest.fn().mockResolvedValue({}),
  };
  const voiceService: any = {
    recordSpeakingTime: jest.fn().mockResolvedValue(undefined),
    isBanned: jest.fn().mockResolvedValue(false),
    ...voiceServiceOverrides,
  };
  const prisma: any = prismaOverrides;

  const state = new VoiceRoomState();
  const broadcaster = new VoiceBroadcaster(state);
  broadcaster.attach(server);
  const coachSession = new VoiceCoachSession(
    coach,
    voiceService,
    state,
    broadcaster,
  );

  const core = new VoiceGateway(
    { onSessionRevoked: () => () => undefined } as any,
    voiceService,
    prisma,
    coach,
    state,
    broadcaster,
    coachSession,
  );
  const chat = new VoiceChatGateway(voiceService, state, broadcaster);
  const moderation = new VoiceModerationGateway(
    voiceService,
    prisma,
    state,
    broadcaster,
  );
  const coaching = new VoiceCoachGateway(
    voiceService,
    coach,
    state,
    broadcaster,
    coachSession,
  );
  for (const gateway of [core, chat, moderation, coaching]) {
    (gateway as any).server = server;
  }

  return {
    core,
    chat,
    moderation,
    coaching,
    state,
    emitted,
    coach,
    voiceService,
    server,
  };
};

const socket = (
  rooms: string[] = [],
  data: Record<string, any> = { userId: 'u1', userName: 'Ana' },
) => {
  const toEmits: Array<{ room: string; event: string }> = [];
  return {
    id: 's1',
    data,
    rooms: new Set(['s1', ...rooms]),
    emit: jest.fn(),
    to: (room: string) => ({
      emit: (event: string) => toEmits.push({ room, event }),
    }),
    toEmits,
  } as any;
};

describe('Voice gateways: events must come from a socket that joined the room', () => {
  it('voice:speaking is ignored from outside the room and accepted from inside', async () => {
    const { coaching, emitted } = makeGateway();
    await coaching.handleSpeaking(socket([]), {
      roomId: 'r1',
      isSpeaking: true,
    });
    expect(emitted).toHaveLength(0);

    await coaching.handleSpeaking(socket(['voice:r1']), {
      roomId: 'r1',
      isSpeaking: true,
    });
    expect(emitted.map((e) => e.event)).toEqual(['voice:speaking-status']);
  });

  it("speaking in someone else's room records no speaking time (no XP farming)", async () => {
    const { coaching, voiceService, state } = makeGateway();
    const outsider = socket([]);
    await coaching.handleSpeaking(outsider, { roomId: 'r1', isSpeaking: true });
    await coaching.handleSpeaking(outsider, {
      roomId: 'r1',
      isSpeaking: false,
    });
    expect(voiceService.recordSpeakingTime).not.toHaveBeenCalled();
    expect(state.speakingSince.size).toBe(0);
  });

  it('typing indicators only go out for rooms the socket is in', () => {
    const { chat } = makeGateway();
    const outsider = socket([]);
    chat.handleTypingStart(outsider, { roomId: 'r1' });
    chat.handleTypingStop(outsider, { roomId: 'r1' });
    expect(outsider.toEmits).toHaveLength(0);

    const member = socket(['voice:r1']);
    chat.handleTypingStart(member, { roomId: 'r1' });
    chat.handleTypingStop(member, { roomId: 'r1' });
    expect(member.toEmits.map((e: any) => e.event)).toEqual([
      'voice:typing-start',
      'voice:typing-stop',
    ]);
  });

  it('stage reactions only reach rooms the socket is in', () => {
    const { chat, emitted } = makeGateway();
    chat.handleStageReaction(socket([]), { roomId: 'r1', emoji: '🔥' });
    expect(emitted).toHaveLength(0);
    chat.handleStageReaction(socket(['voice:r1']), {
      roomId: 'r1',
      emoji: '🔥',
    });
    expect(emitted.map((e) => e.event)).toEqual(['voice:stage-reaction']);
  });

  it('captions cannot be injected into a room the socket is not in', async () => {
    const { coaching, emitted, coach } = makeGateway();
    await coaching.handleTranscription(socket([]), {
      roomId: 'r1',
      text: 'fake line',
      isFinal: true,
    });
    expect(emitted).toHaveLength(0);
    expect(coach.onFinalUtterance).not.toHaveBeenCalled();

    await coaching.handleTranscription(socket(['voice:r1']), {
      roomId: 'r1',
      text: 'real line',
      isFinal: false,
    });
    expect(emitted.map((e) => e.event)).toEqual(['voice:transcription']);
  });

  it('a non-string or missing room id is rejected quietly', async () => {
    const { coaching, emitted } = makeGateway();
    await coaching.handleSpeaking(socket(['voice:undefined']), {
      roomId: undefined as any,
      isSpeaking: true,
    });
    await coaching.handleSpeaking(socket([]), undefined as any);
    expect(emitted).toHaveLength(0);
  });
});

describe('VoiceGateway: joining a private room', () => {
  const roomRow = (over: any = {}) => ({
    id: 'r1',
    status: 'ACTIVE',
    type: 'PRIVATE',
    creatorId: 'host',
    participants: [],
    messages: [],
    ...over,
  });

  const run = async (room: any, existing: any) => {
    const create = jest.fn().mockResolvedValue({});
    const { core, state } = makeGateway({
      voiceRoom: { findUnique: jest.fn().mockResolvedValue(room) },
      voiceParticipant: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create,
        update: jest.fn(),
      },
    });
    const client = socket([]);
    client.join = jest.fn().mockResolvedValue(undefined);
    // stop right after the access decision: everything past it needs the full database
    state.addParticipant = () => {
      throw new Error('PAST_ACCESS_CHECK');
    };
    await core.handleJoin(client, { roomId: 'r1' }).catch(() => undefined);
    return { client, create };
  };

  it('turns away someone who was never invited, creating nothing', async () => {
    const { client, create } = await run(roomRow(), null);
    expect(client.emit).toHaveBeenCalledWith(
      'voice:error',
      expect.objectContaining({ message: expect.stringContaining('private') }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('lets an invited person in (they already have a participant row)', async () => {
    const { client, create } = await run(roomRow(), {
      roomId: 'r1',
      userId: 'u1',
      leftAt: null,
    });
    expect(client.join).toHaveBeenCalledWith('voice:r1');
    expect(create).not.toHaveBeenCalled();
  });

  it('lets the creator in even without a row', async () => {
    const { client } = await run(roomRow({ creatorId: 'u1' }), null);
    expect(client.join).toHaveBeenCalledWith('voice:r1');
  });

  it('open rooms still admit anyone', async () => {
    const { client, create } = await run(roomRow({ type: 'OPEN' }), null);
    expect(client.join).toHaveBeenCalledWith('voice:r1');
    expect(create).toHaveBeenCalled();
  });
});

describe('VoiceGateway: kick bans', () => {
  const hostSocket = () =>
    socket(['voice:r1'], { userId: 'host', userName: 'Host' });

  it('tells the host why when they are not allowed to kick (instead of a generic failure)', async () => {
    const { moderation } = makeGateway(
      {},
      {
        kickParticipant: jest
          .fn()
          .mockRejectedValue(
            new ForbiddenException('Only the host can kick members'),
          ),
      },
    );
    const client = hostSocket();
    await moderation.handleKick(client, { roomId: 'r1', userId: 'guest' });
    expect(client.emit).toHaveBeenCalledWith('voice:error', {
      message: 'Only the host can kick members',
    });
  });

  it('bans through the service, closes every tab of the person and removes them from audio', async () => {
    const kickParticipant = jest
      .fn()
      .mockResolvedValue({ id: 'r1', liveKitRoomId: 'lk-1' });
    const removeFromAudio = jest.fn().mockResolvedValue(undefined);
    const { moderation, state, server, emitted } = makeGateway(
      {},
      { kickParticipant, removeFromAudio },
    );
    const left: string[] = [];
    const told: string[] = [];
    server.to = (target: string) => ({
      emit: (event: string) =>
        event === 'voice:kicked' ? told.push(target) : undefined,
    });
    server.in = (target: string) => ({ socketsLeave: () => left.push(target) });
    await moderation.handleKick(hostSocket(), {
      roomId: 'r1',
      userId: 'guest',
    });

    expect(kickParticipant).toHaveBeenCalledWith('host', 'r1', 'guest');
    expect(told).toEqual(expect.arrayContaining(['voice:r1', 'user:guest']));
    expect(left).toEqual(['user:guest']);
    expect(removeFromAudio).toHaveBeenCalledWith('lk-1', 'guest');
    expect(emitted).toEqual([]); // nothing leaked through the default stub
  });

  it('a banned person is refused at voice:join and never enters the socket room', async () => {
    const { core } = makeGateway(
      {
        voiceRoom: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'r1',
            status: 'ACTIVE',
            type: 'OPEN',
            creatorId: 'host',
            participants: [],
            messages: [],
          }),
        },
        voiceParticipant: { findUnique: jest.fn(), create: jest.fn() },
      },
      { isBanned: jest.fn().mockResolvedValue(true) },
    );
    const client = socket([]);
    client.join = jest.fn();
    await core.handleJoin(client, { roomId: 'r1' });

    expect(client.emit).toHaveBeenCalledWith(
      'voice:error',
      expect.objectContaining({ message: expect.stringContaining('removed') }),
    );
    expect(client.join).not.toHaveBeenCalled();
  });
});

describe('VoiceGateway: a host mute cannot be undone by the muted person', () => {
  const run = async (current: any, muted: boolean) => {
    const update = jest.fn().mockResolvedValue({});
    const { moderation, emitted } = makeGateway({
      voiceParticipant: {
        findUnique: jest.fn().mockResolvedValue(current),
        update,
      },
    });
    const client = socket(['voice:r1']);
    await moderation.handleMuteSelf(client, { roomId: 'r1', muted });
    return { client, update, emitted };
  };

  it('refuses to unmute and puts the client back in the muted state', async () => {
    const { client, update, emitted } = await run({ mutedByHost: true }, false);
    expect(update).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
    expect(client.emit).toHaveBeenCalledWith(
      'voice:error',
      expect.objectContaining({
        message: expect.stringContaining('muted by the host'),
      }),
    );
    expect(client.emit).toHaveBeenCalledWith('voice:self-muted', {
      userId: 'u1',
      muted: true,
    });
  });

  it('still lets them mute themselves further', async () => {
    const { update } = await run({ mutedByHost: true }, true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isMuted: true } }),
    );
  });

  it('an ordinary self-mute and unmute work as before', async () => {
    const off = await run({ mutedByHost: false }, true);
    expect(off.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isMuted: true } }),
    );
    expect(off.emitted.map((e) => e.event)).toEqual(['voice:self-muted']);

    const on = await run({ mutedByHost: false }, false);
    expect(on.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isMuted: false } }),
    );
  });
});
