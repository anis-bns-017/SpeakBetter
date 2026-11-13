// server/src/auth/account-deletion.service.ts
// "Delete my account", done by the account's owner. To make sure it's really them (not someone at an unlocked
// computer), it asks again for the password, or, for Google-only accounts, for the email address typed out.
// Deleting removes the account and everything it owns (the database cascades it); communities and rooms the
// person created go with it, which the preview tells them first. The last admin can't delete themselves.

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';

export type DeletionCheck = 'password' | 'email';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private mail: MailService,
  ) {}

  /** What deleting would remove, and how the person will be asked to confirm */
  async preview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
    if (!user) throw new NotFoundException('Account not found');
    const [communities, otherMembers, rooms, admins] = await Promise.all([
      this.prisma.community.count({ where: { ownerId: userId } }),
      this.prisma.communityMember.count({ where: { community: { ownerId: userId }, userId: { not: userId } } }),
      this.prisma.voiceRoom.count({ where: { creatorId: userId, status: { in: ['WAITING', 'ACTIVE'] } } }),
      user.role === 'ADMIN' ? this.prisma.user.count({ where: { role: 'ADMIN' } }) : Promise.resolve(2),
    ]);
    return {
      check: (user.passwordHash ? 'password' : 'email') as DeletionCheck,
      communitiesOwned: communities,
      membersInThem: otherMembers,
      liveRoomsOwned: rooms,
      lastAdmin: user.role === 'ADMIN' && admins <= 1,
    };
  }

  /** Deletes the account for good, after checking it's really the owner */
  async remove(userId: string, input: { password?: unknown; confirmEmail?: unknown }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, passwordHash: true, role: true },
    });
    if (!user) throw new NotFoundException('Account not found');

    if (user.passwordHash) {
      const ok = typeof input.password === 'string' && input.password.length > 0 && (await bcrypt.compare(input.password, user.passwordHash));
      // 403, not 401: a 401 would make the app think the session ended and try to refresh it
      if (!ok) throw new ForbiddenException({ code: 'WRONG_PASSWORD', message: 'That password is not right' });
    } else if (typeof input.confirmEmail !== 'string' || input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('Type your email address exactly to confirm');
    }

    if (user.role === 'ADMIN' && (await this.prisma.user.count({ where: { role: 'ADMIN' } })) <= 1) {
      throw new ForbiddenException('You are the only admin. Make someone else an admin first, so SpeakBetter keeps one.');
    }

    await this.auth.logoutAll(user.id, 'account_deleted');
    await this.prisma.user.delete({ where: { id: user.id } });
    this.logger.log(`Account ${user.id} was deleted by its owner`);

    const first = user.name.split(/\s+/)[0] || 'there';
    await this.mail.send({
      to: user.email,
      subject: 'Your SpeakBetter account was deleted',
      text: `Hi ${first},\n\nYour SpeakBetter account and everything in it have been deleted, as you asked. We're sorry to see you go.\n\nYou're always welcome back with a new account.\n\nSpeakBetter`,
      html: `<p>Hi ${first.replace(/[<>&"]/g, '')},</p><p>Your SpeakBetter account and everything in it have been deleted, as you asked. We're sorry to see you go.</p><p>You're always welcome back with a new account.</p><p>SpeakBetter</p>`,
    });
    return { ok: true };
  }
}
