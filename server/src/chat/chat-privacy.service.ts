import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

export interface ChatPrivacy {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  sendReadReceipts: boolean;
  showTypingIndicator: boolean;
}

const DEFAULT_PRIVACY: ChatPrivacy = {
  showOnlineStatus: true,
  showLastSeen: true,
  sendReadReceipts: true,
  showTypingIndicator: true,
};

const PRIVACY_SELECT = {
  userId: true,
  showOnlineStatus: true,
  showLastSeen: true,
  sendReadReceipts: true,
  showTypingIndicator: true,
} as const;

const CACHE_MS = 15_000;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60_000;

/**
 * Chat privacy settings (each is mutual, like WhatsApp: hide yours and you stop
 * seeing other people's) and the chat-lock PIN. Settings are read on every
 * presence/typing/read event, so they're cached briefly.
 */
@Injectable()
export class ChatPrivacyService {
  private cache = new Map<string, { value: ChatPrivacy; at: number }>();
  private pinAttempts = new Map<string, { count: number; until: number }>();

  constructor(private prisma: PrismaService) {}

  async get(userId: string): Promise<ChatPrivacy> {
    return (await this.getMany([userId])).get(userId)!;
  }

  async getMany(userIds: string[]): Promise<Map<string, ChatPrivacy>> {
    const result = new Map<string, ChatPrivacy>();
    const now = Date.now();
    const missing: string[] = [];
    for (const id of new Set(userIds)) {
      const hit = this.cache.get(id);
      if (hit && now - hit.at < CACHE_MS) result.set(id, hit.value);
      else missing.push(id);
    }
    if (missing.length) {
      const rows = await this.prisma.settings.findMany({
        where: { userId: { in: missing } },
        select: PRIVACY_SELECT,
      });
      const byUser = new Map(rows.map((r) => [r.userId, r]));
      for (const id of missing) {
        const row = byUser.get(id);
        const value: ChatPrivacy = row
          ? {
              showOnlineStatus: row.showOnlineStatus,
              showLastSeen: row.showLastSeen,
              sendReadReceipts: row.sendReadReceipts,
              showTypingIndicator: row.showTypingIndicator,
            }
          : DEFAULT_PRIVACY;
        this.cache.set(id, { value, at: now });
        result.set(id, value);
      }
    }
    return result;
  }

  async getView(userId: string) {
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
      select: { ...PRIVACY_SELECT, chatLockPinHash: true },
    });
    return {
      showOnlineStatus: settings?.showOnlineStatus ?? true,
      showLastSeen: settings?.showLastSeen ?? true,
      sendReadReceipts: settings?.sendReadReceipts ?? true,
      showTypingIndicator: settings?.showTypingIndicator ?? true,
      hasChatLockPin: Boolean(settings?.chatLockPinHash),
    };
  }

  async update(userId: string, changes: Partial<ChatPrivacy>) {
    await this.prisma.settings.upsert({
      where: { userId },
      create: { userId, ...changes },
      update: changes,
    });
    this.cache.delete(userId);
    return this.getView(userId);
  }

  // ============ CHAT LOCK PIN ============

  async hasPin(userId: string) {
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
      select: { chatLockPinHash: true },
    });
    return Boolean(settings?.chatLockPinHash);
  }

  /** Set or change the PIN; changing needs the current one */
  async setPin(userId: string, pin: string, currentPin?: string) {
    this.assertPinFormat(pin);
    if (await this.hasPin(userId)) {
      if (!currentPin) throw new BadRequestException('Enter your current PIN to change it');
      await this.verifyPin(userId, currentPin);
    }
    const chatLockPinHash = await bcrypt.hash(pin, 10);
    await this.prisma.settings.upsert({
      where: { userId },
      create: { userId, chatLockPinHash },
      update: { chatLockPinHash },
    });
    return this.getView(userId);
  }

  /** Removing the PIN unlocks every locked chat */
  async removePin(userId: string, currentPin: string) {
    await this.verifyPin(userId, currentPin);
    await this.prisma.$transaction([
      this.prisma.settings.update({ where: { userId }, data: { chatLockPinHash: null } }),
      this.prisma.chatParticipant.updateMany({
        where: { userId, isLocked: true },
        data: { isLocked: false },
      }),
    ]);
    return this.getView(userId);
  }

  /** Throws unless the PIN matches; 5 wrong tries locks it for 5 minutes */
  async verifyPin(userId: string, pin: string): Promise<true> {
    const attempts = this.pinAttempts.get(userId);
    if (attempts && attempts.count >= PIN_MAX_ATTEMPTS && attempts.until > Date.now()) {
      throw new HttpException('Too many wrong PINs. Try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
      select: { chatLockPinHash: true },
    });
    if (!settings?.chatLockPinHash) throw new BadRequestException('Set a chat lock PIN first');

    const ok = await bcrypt.compare(String(pin || ''), settings.chatLockPinHash);
    if (!ok) {
      const count = attempts && attempts.until > Date.now() ? attempts.count + 1 : 1;
      this.pinAttempts.set(userId, { count, until: Date.now() + PIN_LOCKOUT_MS });
      throw new ForbiddenException('Wrong PIN');
    }
    this.pinAttempts.delete(userId);
    return true;
  }

  private assertPinFormat(pin: string) {
    if (!/^\d{4,6}$/.test(String(pin || ''))) {
      throw new BadRequestException('PIN must be 4–6 digits');
    }
  }
}
