import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AdminReportsService } from './admin-reports.service';
import type { Actor } from './admin.roles';

const ADMIN: Actor = { id: 'admin1', name: 'Ada', role: 'ADMIN' };
const MOD: Actor = { id: 'mod1', name: 'Mo', role: 'MODERATOR' };

function setup(options: { callStatus?: string; appStatus?: string; refuse?: boolean } = {}) {
  const callReport: any = { id: 'c1', status: options.callStatus ?? 'PENDING', reason: 'HARASSMENT', reportedId: 'bad', reported: { name: 'Bad' } };
  const appReport: any = { id: 'a1', status: options.appStatus ?? 'PENDING', reason: 'SPAM', targetType: 'THREAD', targetId: 'post1', description: null };
  const update = (row: any, statuses: string[], data: any) => {
    if (!statuses.includes(row.status)) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  };
  const prisma: any = {
    randomCallReport: {
      findUnique: jest.fn(async () => callReport),
      updateMany: jest.fn(async ({ where, data }: any) => update(callReport, where.status.in, data)),
      update: jest.fn(async ({ data }: any) => Object.assign(callReport, data)),
      count: jest.fn(async () => 0),
    },
    report: {
      findUnique: jest.fn(async () => appReport),
      findMany: jest.fn(async () => [{ ...appReport, createdAt: new Date(), resolution: null, reportedBy: { id: 'r1', name: 'Reporter', avatarUrl: null } }]),
      updateMany: jest.fn(async ({ where, data }: any) => update(appReport, where.status.in, data)),
      update: jest.fn(async ({ data }: any) => Object.assign(appReport, data)),
      count: jest.fn(async () => 0),
    },
    thread: {
      findMany: jest.fn(async () => [
        { id: 'post1', title: 'Buy now', content: 'Cheap', author: { id: 'spammer', name: 'Spammer', avatarUrl: null }, channel: { name: 'general', community: { name: 'Club' } } },
      ]),
    },
    threadMessage: { findMany: jest.fn(async () => []) },
  };
  const audit: any = { record: jest.fn() };
  const users: any = {
    assertCanModerate: options.refuse
      ? jest.fn().mockRejectedValue(new ForbiddenException('Moderators can only act on normal accounts'))
      : jest.fn().mockResolvedValue(undefined),
    suspend: jest.fn().mockResolvedValue({ ok: true }),
    warn: jest.fn().mockResolvedValue({ ok: true }),
  };
  const content: any = { deleteMessage: jest.fn().mockResolvedValue({ ok: true }) };
  const calls: any = { applyRestriction: jest.fn().mockResolvedValue(true) };
  const service = new AdminReportsService(prisma, audit, users, content, calls);
  return { service, callReport, appReport, audit, users, content, calls };
}

describe('resolving reports', () => {
  it('refuses a report that was already handled, so nobody is punished twice', async () => {
    const { service, users, calls } = setup({ callStatus: 'UPHELD' });
    await expect(service.resolve(ADMIN, 'random-call', 'c1', { decision: 'action', suspendDays: 3 })).rejects.toThrow(ConflictException);
    expect(users.suspend).not.toHaveBeenCalled();
    expect(calls.applyRestriction).not.toHaveBeenCalled();
    const app = setup({ appStatus: 'RESOLVED' });
    await expect(app.service.resolve(ADMIN, 'app', 'a1', { decision: 'dismiss' })).rejects.toThrow(ConflictException);
  });

  it('leaves everything untouched when the decision is not allowed', async () => {
    const { service, appReport, content, users } = setup({ refuse: true });
    await expect(service.resolve(MOD, 'app', 'a1', { decision: 'action', deleteContent: true, permanent: true })).rejects.toThrow(ForbiddenException);
    expect(appReport.status).toBe('PENDING');
    expect(content.deleteMessage).not.toHaveBeenCalled();
    expect(users.suspend).not.toHaveBeenCalled();
  });

  it('pauses random calls when a call report is upheld, and not when dismissed', async () => {
    const upheld = setup();
    await upheld.service.resolve(MOD, 'random-call', 'c1', { decision: 'action' });
    expect(upheld.callReport.status).toBe('UPHELD');
    expect(upheld.calls.applyRestriction).toHaveBeenCalledWith('bad', expect.stringContaining('HARASSMENT'));
    expect(upheld.audit.record.mock.calls[0][1].summary).toContain('paused their random calls');

    const dismissed = setup();
    await dismissed.service.resolve(MOD, 'random-call', 'c1', { decision: 'dismiss' });
    expect(dismissed.callReport.status).toBe('DISMISSED');
    expect(dismissed.calls.applyRestriction).not.toHaveBeenCalled();
  });

  it('can remove a reported community post', async () => {
    const { service, content, users, appReport } = setup();
    await service.resolve(MOD, 'app', 'a1', { decision: 'action', deleteContent: true, warn: 'Please stop selling here' });
    expect(content.deleteMessage).toHaveBeenCalledWith(MOD, 'thread', 'post1', expect.any(String));
    expect(users.warn).toHaveBeenCalledWith(MOD, 'spammer', 'Please stop selling here');
    expect(appReport.status).toBe('RESOLVED');
  });

  it('puts the report back in the queue if the action fails before doing anything', async () => {
    const { service, callReport, calls } = setup();
    calls.applyRestriction.mockRejectedValueOnce(new Error('database down'));
    await expect(service.resolve(MOD, 'random-call', 'c1', { decision: 'action' })).rejects.toThrow('database down');
    expect(callReport.status).toBe('PENDING');
  });

  it('shows where a reported post is', async () => {
    const { service } = setup();
    const list = await service.list({ state: 'open', source: 'app' });
    expect(list.items[0]).toMatchObject({
      targetType: 'thread',
      content: 'Buy now: Cheap',
      where: 'Community “Club” · #general',
      subject: { id: 'spammer' },
    });
  });
});
