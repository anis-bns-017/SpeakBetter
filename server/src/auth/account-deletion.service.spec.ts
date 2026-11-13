import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountDeletionService } from './account-deletion.service';

async function setup(user: { role?: string; passwordHash?: string | null } = {}, admins = 1) {
  const row = {
    id: 'u1',
    name: 'Mina Rahman',
    email: 'mina@example.test',
    role: user.role ?? 'USER',
    passwordHash: user.passwordHash === undefined ? await bcrypt.hash('right-pass-1', 4) : user.passwordHash,
  };
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(row),
      count: jest.fn().mockResolvedValue(admins),
      delete: jest.fn().mockResolvedValue(row),
    },
    community: { count: jest.fn().mockResolvedValue(2) },
    communityMember: { count: jest.fn().mockResolvedValue(15) },
    voiceRoom: { count: jest.fn().mockResolvedValue(1) },
  };
  const auth = { logoutAll: jest.fn().mockResolvedValue({ success: true, revokedFamilies: 1 }) };
  const mail = { send: jest.fn().mockResolvedValue(true) };
  return { service: new AccountDeletionService(prisma, auth as any, mail as any), prisma, auth, mail };
}

describe('AccountDeletionService', () => {
  it('previews what goes with the account and how to confirm', async () => {
    const { service } = await setup();
    expect(await service.preview('u1')).toEqual({ check: 'password', communitiesOwned: 2, membersInThem: 15, liveRoomsOwned: 1, lastAdmin: false });
    const google = await setup({ passwordHash: null, role: 'ADMIN' }, 1);
    expect(await google.service.preview('u1')).toMatchObject({ check: 'email', lastAdmin: true });
  });

  it('needs the right password, then signs out, deletes and says goodbye by email', async () => {
    const { service, prisma, auth, mail } = await setup();
    await expect(service.remove('u1', { password: 'wrong' })).rejects.toThrow(ForbiddenException);
    await expect(service.remove('u1', {})).rejects.toThrow(ForbiddenException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(await service.remove('u1', { password: 'right-pass-1' })).toEqual({ ok: true });
    expect(auth.logoutAll).toHaveBeenCalledWith('u1', 'account_deleted');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(mail.send.mock.calls[0][0]).toMatchObject({ to: 'mina@example.test', subject: 'Your SpeakBetter account was deleted' });
  });

  it('asks Google-only accounts to type their email', async () => {
    const { service, prisma } = await setup({ passwordHash: null });
    await expect(service.remove('u1', { confirmEmail: 'someone@else.test' })).rejects.toThrow(BadRequestException);
    await service.remove('u1', { confirmEmail: ' MINA@example.test ' });
    expect(prisma.user.delete).toHaveBeenCalled();
  });

  it('never deletes the last admin', async () => {
    const { service, prisma } = await setup({ role: 'ADMIN' }, 1);
    await expect(service.remove('u1', { password: 'right-pass-1' })).rejects.toThrow(/only admin/);
    expect(prisma.user.delete).not.toHaveBeenCalled();
    const two = await setup({ role: 'ADMIN' }, 2);
    await two.service.remove('u1', { password: 'right-pass-1' });
    expect(two.prisma.user.delete).toHaveBeenCalled();
  });
});
