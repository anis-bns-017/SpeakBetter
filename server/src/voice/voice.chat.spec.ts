import { VoiceService, DELETED_MESSAGE_TYPE } from './voice.service';

/** In-memory stand-ins for the tables the room chat touches */
const makeService = () => {
  const messages = new Map<string, any>();
  const reactions: Array<{ id: string; messageId: string; userId: string; emoji: string; createdAt: Date }> = [];
  const participants: Record<string, { role: string; leftAt: Date | null }> = {
    host: { role: 'LISTENER', leftAt: null },
    mod: { role: 'MODERATOR', leftAt: null },
    ana: { role: 'LISTENER', leftAt: null },
    ben: { role: 'LISTENER', leftAt: null },
    gone: { role: 'LISTENER', leftAt: new Date() },
  };
  const reports: any[] = [];
  let seq = 0;

  const prisma: any = {
    voiceRoom: {
      findUnique: jest.fn(async () => ({ id: 'r1', creatorId: 'host' })),
    },
    voiceParticipant: {
      findUnique: jest.fn(async ({ where }) => participants[where.roomId_userId.userId] ?? null),
    },
    voiceRoomMessage: {
      findUnique: jest.fn(async ({ where }) => messages.get(where.id) ?? null),
      // Like Prisma's include, replyTo is the replied-to row as it is now
      findMany: jest.fn(async () =>
        [...messages.values()].reverse().map((m) => ({ ...m, replyTo: m.replyToId ? messages.get(m.replyToId) : null })),
      ),
      create: jest.fn(async ({ data }) => {
        const m = { id: `m${++seq}`, isPinned: false, isEdited: false, createdAt: new Date(), editedAt: null, reactions: [], replyTo: data.replyToId ? messages.get(data.replyToId) : null, ...data };
        messages.set(m.id, m);
        return m;
      }),
      update: jest.fn(async ({ where, data }) => {
        const m = { ...messages.get(where.id), ...data };
        messages.set(where.id, m);
        return m;
      }),
    },
    voiceRoomMessageReaction: {
      findUnique: jest.fn(async ({ where }) => {
        const k = where.messageId_userId_emoji;
        return reactions.find((r) => r.messageId === k.messageId && r.userId === k.userId && r.emoji === k.emoji) ?? null;
      }),
      create: jest.fn(async ({ data }) => {
        const r = { id: `x${++seq}`, createdAt: new Date(), ...data };
        reactions.push(r);
        return r;
      }),
      delete: jest.fn(async ({ where }) => {
        reactions.splice(reactions.findIndex((r) => r.id === where.id), 1);
      }),
      deleteMany: jest.fn(async ({ where }) => {
        for (let i = reactions.length - 1; i >= 0; i--) if (reactions[i].messageId === where.messageId) reactions.splice(i, 1);
      }),
      findMany: jest.fn(async ({ where }) => reactions.filter((r) => r.messageId === where.messageId)),
    },
    report: {
      findFirst: jest.fn(async ({ where }) => reports.find((r) => r.reportedById === where.reportedById && r.targetId === where.targetId) ?? null),
      create: jest.fn(async ({ data }) => {
        reports.push({ id: `rep${reports.length + 1}`, ...data });
        return data;
      }),
    },
    profile: {
      findUnique: jest.fn(async () => ({ nativeLanguage: 'Spanish' })),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const service = new VoiceService(prisma, {} as any, {} as any);
  return { service, prisma, messages, reactions, reports };
};

describe('VoiceService room chat', () => {
  it('keeps the attachment fields and rejects empty or over-long messages', async () => {
    const { service } = makeService();
    const sent = await service.sendVoiceRoomMessage('ana', 'r1', 'photo.png', 'IMAGE', 'https://cdn/x/photo.png');
    expect(sent).toMatchObject({ type: 'IMAGE', mediaUrl: 'https://cdn/x/photo.png', isDeleted: false });

    await expect(service.sendVoiceRoomMessage('ana', 'r1', '   ')).rejects.toThrow(/empty/);
    await expect(service.sendVoiceRoomMessage('ana', 'r1', 'x'.repeat(2001))).rejects.toThrow(/2000/);
    // Unknown types fall back to TEXT instead of reaching the database
    const odd = await service.sendVoiceRoomMessage('ana', 'r1', 'hi', 'SYSTEM');
    expect(odd.type).toBe('TEXT');
  });

  it('only lets people who are still in the room send', async () => {
    const { service } = makeService();
    await expect(service.sendVoiceRoomMessage('gone', 'r1', 'hello?')).rejects.toThrow(/in the room/);
    await expect(service.sendVoiceRoomMessage('stranger', 'r1', 'hello?')).rejects.toThrow(/in the room/);
  });

  it('lets only the sender edit, and refuses edits to deleted messages', async () => {
    const { service } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'I goed home');
    await expect(service.editVoiceRoomMessage('mod', 'r1', m.id, 'changed')).rejects.toThrow(/your own/);
    const edited = await service.editVoiceRoomMessage('ana', 'r1', m.id, 'I went home');
    expect(edited).toMatchObject({ content: 'I went home', isEdited: true });

    await service.deleteVoiceRoomMessage('ana', 'r1', m.id);
    await expect(service.editVoiceRoomMessage('ana', 'r1', m.id, 'again')).rejects.toThrow(/deleted/);
  });

  it('lets the sender, the host and moderators delete — and leaves a tombstone', async () => {
    const { service, messages, reactions } = makeService();
    const a = await service.sendVoiceRoomMessage('ana', 'r1', 'one');
    const b = await service.sendVoiceRoomMessage('ana', 'r1', 'two');
    const c = await service.sendVoiceRoomMessage('ana', 'r1', 'three');

    await expect(service.deleteVoiceRoomMessage('ben', 'r1', a.id)).rejects.toThrow(/sender or a moderator/);

    await service.toggleVoiceRoomMessageReaction('ben', 'r1', a.id, '🔥');
    await service.deleteVoiceRoomMessage('ana', 'r1', a.id);
    await service.deleteVoiceRoomMessage('host', 'r1', b.id); // room creator, not a MODERATOR participant
    await service.deleteVoiceRoomMessage('mod', 'r1', c.id);

    for (const id of [a.id, b.id, c.id]) expect(messages.get(id).type).toBe(DELETED_MESSAGE_TYPE);
    expect(reactions).toHaveLength(0);

    const history = await service.getVoiceRoomMessages('ben', 'r1');
    expect(history.every((m) => m.isDeleted && m.content === '' && m.mediaUrl === null)).toBe(true);
  });

  it('shows a reply to a deleted message as deleted', async () => {
    const { service } = makeService();
    const original = await service.sendVoiceRoomMessage('ana', 'r1', 'secret');
    const reply = await service.sendVoiceRoomMessage('ben', 'r1', 'nice', 'TEXT', undefined, undefined, original.id);
    await service.deleteVoiceRoomMessage('ana', 'r1', original.id);
    const history = await service.getVoiceRoomMessages('ben', 'r1');
    const shown = history.find((m) => m.id === reply.id)!;
    expect(shown.replyTo).toMatchObject({ isDeleted: true, content: '' });
  });

  it('toggles one reaction per call and returns the full map', async () => {
    const { service } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'hey');
    expect((await service.toggleVoiceRoomMessageReaction('ben', 'r1', m.id, '❤️')).reactions).toEqual({ '❤️': ['ben'] });
    expect((await service.toggleVoiceRoomMessageReaction('mod', 'r1', m.id, '❤️')).reactions).toEqual({ '❤️': ['ben', 'mod'] });
    expect((await service.toggleVoiceRoomMessageReaction('ben', 'r1', m.id, '❤️')).reactions).toEqual({ '❤️': ['mod'] });
  });

  it('lets the host and moderators pin, but not listeners', async () => {
    const { service } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'Topic: travel');
    await expect(service.pinVoiceRoomMessage('ana', 'r1', m.id, true)).rejects.toThrow(/host or a moderator/);
    expect((await service.pinVoiceRoomMessage('host', 'r1', m.id, true)).isPinned).toBe(true);
    expect((await service.pinVoiceRoomMessage('mod', 'r1', m.id, false)).isPinned).toBe(false);
  });

  it('files one report per person and message, never for your own', async () => {
    const { service, reports } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'buy followers at spam.example');
    await expect(service.reportVoiceRoomMessage('ana', 'r1', m.id, 'Spam')).rejects.toThrow(/your own/);
    expect(await service.reportVoiceRoomMessage('ben', 'r1', m.id, 'Spam')).toEqual({ ok: true, alreadyReported: false });
    expect(await service.reportVoiceRoomMessage('ben', 'r1', m.id, 'Spam')).toEqual({ ok: true, alreadyReported: true });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ targetType: 'MESSAGE', targetId: m.id, reason: 'Spam' });
  });

  it("translates into the reader's native language unless a target is given", async () => {
    const { service } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'Good morning');
    expect(await service.getVoiceRoomMessageForTranslation('ben', 'r1', m.id)).toMatchObject({ text: 'Good morning', language: 'Spanish' });
    expect((await service.getVoiceRoomMessageForTranslation('ben', 'r1', m.id, 'French')).language).toBe('French');
  });

  it('refuses messages from another room', async () => {
    const { service } = makeService();
    const m = await service.sendVoiceRoomMessage('ana', 'r1', 'hi');
    await expect(service.pinVoiceRoomMessage('host', 'r2', m.id, true)).rejects.toThrow(/not found/);
  });
});
