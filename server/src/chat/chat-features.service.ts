import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepgramClient } from '@deepgram/sdk';
import { OpenAI } from 'openai';
import { MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ChatService } from './chat.service';
import { ChatPrivacyService } from './chat-privacy.service';
import { LinkPreviewService, firstUrl } from './link-preview.service';
import { MESSAGE_INCLUDE, metaOf, presentMessage, visibleMessagesWhere } from './chat.presenter';
import { destroyCloudinaryUrl } from './cloudinary-assets';
import { ScheduleMessageDto, UpdateChatStateDto } from './dto/chat-features.dto';

const DISAPPEARING_LABELS: Record<number, string> = {
  [24 * 3600]: '24 hours',
  [7 * 24 * 3600]: '7 days',
  [90 * 24 * 3600]: '90 days',
};

/** "Mute always" is stored as a far-future date */
const MUTE_FOREVER = new Date('9999-12-31T00:00:00Z');
/** Viewer has this long to look at view-once media before the file is deleted */
const VIEW_ONCE_GRACE_MS = 60_000;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 3600_000;

/**
 * Premium chat features: chat list state (pin/archive/mute/lock/clear),
 * disappearing messages, view-once media, forwarding, saved messages,
 * delete-for-me, message info, media gallery, scheduled messages, voice
 * transcription, link previews and reports.
 */
@Injectable()
export class ChatFeaturesService {
  private readonly logger = new Logger(ChatFeaturesService.name);
  private deepgram: DeepgramClient | null = null;
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
    private privacy: ChatPrivacyService,
    private linkPreviews: LinkPreviewService,
    private config: ConfigService,
  ) {}

  // ============ HELPERS ============

  private async participant(userId: string, chatId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw new ForbiddenException('You are not a participant in this chat');
    return participant;
  }

  /** A message in a chat the user belongs to (community messages aren't covered) */
  private async accessibleMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });
    if (!message || !message.chatId || !message.chat) throw new NotFoundException('Message not found');
    if (!message.chat.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('You are not a participant in this chat');
    }
    if (message.isDeleted || (message.expiresAt && message.expiresAt <= new Date())) {
      throw new GoneException('This message is no longer available');
    }
    return message;
  }

  // ============ CHAT LIST STATE ============

  async updateChatState(userId: string, chatId: string, dto: UpdateChatStateDto) {
    await this.participant(userId, chatId);

    const data: Prisma.ChatParticipantUpdateInput = {};
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.isLocked !== undefined) {
      if (dto.isLocked && !(await this.privacy.hasPin(userId))) {
        throw new BadRequestException('Set a chat lock PIN first');
      }
      data.isLocked = dto.isLocked;
    }
    if (dto.mutedUntil !== undefined) {
      if (dto.mutedUntil === null) data.mutedUntil = null;
      else if (dto.mutedUntil === 'always') data.mutedUntil = MUTE_FOREVER;
      else {
        const until = new Date(dto.mutedUntil);
        if (Number.isNaN(until.getTime()) || until <= new Date()) {
          throw new BadRequestException('Choose a time in the future');
        }
        data.mutedUntil = until;
      }
    }

    const updated = await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data,
    });
    return {
      chatId,
      isPinned: updated.isPinned,
      isArchived: updated.isArchived,
      isLocked: updated.isLocked,
      mutedUntil: updated.mutedUntil,
    };
  }

  /** Hides everything so far for this user only */
  async clearHistory(userId: string, chatId: string) {
    await this.participant(userId, chatId);
    const now = new Date();
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { clearedAt: now, lastReadAt: now },
    });
    return { chatId, clearedAt: now };
  }

  async markChatRead(userId: string, chatId: string) {
    await this.participant(userId, chatId);
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { chatId };
  }

  // ============ DISAPPEARING MESSAGES ============

  /** Anyone in a private chat; only admins in a group. Posts a system message. */
  async setDisappearing(userId: string, chatId: string, seconds: number) {
    const me = await this.participant(userId, chatId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type !== 'PRIVATE' && me.role !== 'ADMIN' && me.role !== 'OWNER') {
      throw new ForbiddenException('Only group admins can change disappearing messages');
    }

    const value = seconds > 0 ? seconds : null;
    if (value === chat.disappearingSeconds) return { chatId, seconds: value ?? 0, message: null };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const name = user?.name || 'Someone';
    const content = value
      ? `${name} turned on disappearing messages. New messages will disappear after ${DISAPPEARING_LABELS[value] ?? `${value} seconds`}.`
      : `${name} turned off disappearing messages.`;

    const [, message] = await this.prisma.$transaction([
      this.prisma.chat.update({ where: { id: chatId }, data: { disappearingSeconds: value } }),
      this.prisma.message.create({
        data: {
          chatId,
          senderId: userId,
          type: MessageType.SYSTEM,
          content,
          metadata: { event: 'disappearing', seconds: value ?? 0 },
        },
        include: MESSAGE_INCLUDE,
      }),
    ]);
    return { chatId, seconds: value ?? 0, message: presentMessage(message) };
  }

  /** Deletes messages whose timer ran out; returns their ids per chat for live removal */
  async sweepExpired(): Promise<Map<string, string[]>> {
    const expired = await this.prisma.message.findMany({
      where: { expiresAt: { lte: new Date() } },
      take: 200,
      select: { id: true, chatId: true, mediaUrl: true, fileUrl: true, attachments: { select: { url: true } } },
    });
    const byChat = new Map<string, string[]>();
    if (!expired.length) return byChat;

    const ids = expired.map((m) => m.id);
    await this.prisma.message.deleteMany({ where: { id: { in: ids } } });
    for (const m of expired) {
      if (!m.chatId) continue;
      byChat.set(m.chatId, [...(byChat.get(m.chatId) ?? []), m.id]);
    }

    // Delete the files too — unless a forwarded copy elsewhere still uses them
    const urls = new Set(
      expired.flatMap((m) => [m.mediaUrl, m.fileUrl, ...m.attachments.map((a) => a.url)]).filter(Boolean) as string[],
    );
    for (const url of urls) {
      const stillUsed = await this.prisma.message.count({
        where: { OR: [{ mediaUrl: url }, { fileUrl: url }, { attachments: { some: { url } } }] },
      });
      if (!stillUsed) await destroyCloudinaryUrl(url);
    }
    return byChat;
  }

  // ============ VIEW-ONCE MEDIA ============

  /**
   * The recipient opens a view-once photo/video: they get the URL once, then the
   * file is deleted (after everyone in the chat has opened it).
   */
  async openViewOnce(userId: string, messageId: string) {
    const message = await this.accessibleMessage(userId, messageId);
    if (!message.isViewOnce) throw new BadRequestException('This is not a view-once message');
    if (message.senderId === userId) {
      throw new ForbiddenException("You can't open view-once media you sent");
    }

    const meta = metaOf(message);
    const viewedBy: Array<{ userId: string; at: string }> = Array.isArray(meta.viewedBy) ? meta.viewedBy : [];
    if (viewedBy.some((v) => v.userId === userId) || !message.mediaUrl) {
      throw new GoneException('You already opened this');
    }

    const url = message.mediaUrl;
    meta.viewedBy = [...viewedBy, { userId, at: new Date().toISOString() }];
    const recipients = message.chat!.participants.filter((p) => p.userId !== message.senderId);
    const everyoneViewed = recipients.every((p) => meta.viewedBy.some((v: { userId: string }) => v.userId === p.userId));

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: meta,
        ...(everyoneViewed ? { mediaUrl: null, fileUrl: null, attachments: { deleteMany: {} } } : {}),
      },
      include: MESSAGE_INCLUDE,
    });

    if (everyoneViewed) {
      setTimeout(() => void destroyCloudinaryUrl(url), VIEW_ONCE_GRACE_MS);
    }
    return { url, type: message.type, message: presentMessage(updated) };
  }

  // ============ DELETE FOR ME / SAVED ============

  async hideMessages(userId: string, messageIds: string[]) {
    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds }, chat: { participants: { some: { userId } } } },
      select: { id: true },
    });
    await this.prisma.messageHidden.createMany({
      data: messages.map((m) => ({ userId, messageId: m.id })),
      skipDuplicates: true,
    });
    return { messageIds: messages.map((m) => m.id) };
  }

  async setSaved(userId: string, messageId: string, saved: boolean) {
    await this.accessibleMessage(userId, messageId);
    if (saved) {
      await this.prisma.savedMessage.upsert({
        where: { userId_messageId: { userId, messageId } },
        create: { userId, messageId },
        update: {},
      });
    } else {
      await this.prisma.savedMessage.deleteMany({ where: { userId, messageId } });
    }
    return { messageId, saved };
  }

  /** Saved messages, newest saved first — for one chat, or across all chats */
  async getSaved(userId: string, chatId?: string) {
    const clearedAt = chatId ? (await this.participant(userId, chatId)).clearedAt : null;
    const saved = await this.prisma.savedMessage.findMany({
      where: {
        userId,
        message: {
          ...(chatId ? { chatId } : {}),
          chat: { participants: { some: { userId } } },
          ...visibleMessagesWhere(userId, clearedAt),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        message: {
          include: {
            ...MESSAGE_INCLUDE,
            chat: { select: { id: true, type: true, name: true } },
          },
        },
      },
    });
    return saved.map((s) => ({ ...presentMessage(s.message), isSaved: true, savedAt: s.createdAt }));
  }

  // ============ FORWARD ============

  async forward(userId: string, messageIds: string[], chatIds: string[]) {
    const sources = await this.prisma.message.findMany({
      where: {
        id: { in: messageIds },
        chat: { participants: { some: { userId } } },
        isDeleted: false,
        isViewOnce: false,
        type: { notIn: [MessageType.SYSTEM] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      include: { attachments: true },
    });
    if (!sources.length) throw new BadRequestException('Nothing to forward');

    const sent: Array<{ chatId: string; message: any }> = [];
    let failed = 0;
    for (const chatId of [...new Set(chatIds)]) {
      for (const source of sources) {
        const meta = metaOf(source);
        const carry: Record<string, unknown> = {};
        for (const key of ['fileName', 'fileSize', 'mimeType', 'duration']) {
          if (meta[key] !== undefined) carry[key] = meta[key];
        }
        try {
          const message = await this.chatService.sendMessage(
            userId,
            {
              chatId,
              // A correction loses its context when forwarded; it travels as plain text
              type: source.type === MessageType.CORRECTION ? 'TEXT' : source.type,
              content: source.content ?? '',
              mediaUrl: source.mediaUrl ?? undefined,
              fileUrl: source.fileUrl ?? undefined,
              metadata: carry,
              attachments: source.attachments
                .filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO')
                .map((a) => ({
                  url: a.url,
                  type: a.type as 'IMAGE' | 'VIDEO',
                  filename: a.filename,
                  mimeType: a.mimeType ?? undefined,
                  size: a.size,
                })),
            },
            { forwardedFromId: source.id },
          );
          sent.push({ chatId, message });
        } catch (error: any) {
          failed++;
          this.logger.warn(`Forward to ${chatId} failed: ${error?.message || error}`);
        }
      }
    }
    return { sent, failed };
  }

  // ============ MESSAGE INFO ============

  /** Sent / delivered / read-by — only the sender can see it */
  async getMessageInfo(userId: string, messageId: string) {
    const message = await this.accessibleMessage(userId, messageId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can see message info');
    }
    const viewer = await this.privacy.get(userId);
    const receipts = viewer.sendReadReceipts
      ? await this.prisma.readReceipt.findMany({
          where: { messageId, userId: { not: userId } },
          orderBy: { readAt: 'asc' },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        })
      : [];

    return {
      messageId,
      sentAt: message.createdAt,
      deliveredAt: message.deliveredAt,
      editedAt: message.editedAt,
      expiresAt: message.expiresAt,
      recipients: message.chat!.participants.filter((p) => p.userId !== userId).length,
      readBy: receipts.map((r) => ({ ...r.user, readAt: r.readAt })),
      // Your own read receipts are off, so you don't see other people's either
      receiptsHidden: !viewer.sendReadReceipts,
      viewedBy: message.isViewOnce ? (metaOf(message).viewedBy ?? []) : undefined,
    };
  }

  // ============ MEDIA GALLERY ============

  async getMedia(userId: string, chatId: string, kind: 'media' | 'files' | 'links', before?: string) {
    const me = await this.participant(userId, chatId);
    const where: Prisma.MessageWhereInput = {
      chatId,
      isViewOnce: false,
      ...visibleMessagesWhere(userId, me.clearedAt),
      ...(kind === 'media'
        ? { type: { in: [MessageType.IMAGE, MessageType.VIDEO] }, mediaUrl: { not: null } }
        : kind === 'files'
          ? { type: MessageType.FILE }
          : { type: MessageType.TEXT, content: { contains: 'http', mode: 'insensitive' } }),
    };
    if (before) {
      const cursor = await this.prisma.message.findUnique({ where: { id: before }, select: { createdAt: true } });
      if (cursor) where.createdAt = { lt: cursor.createdAt };
    }
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { sender: { select: { id: true, name: true } }, attachments: true },
    });
    return messages.map(presentMessage);
  }

  // ============ SCHEDULED MESSAGES ============

  async schedule(userId: string, chatId: string, dto: ScheduleMessageDto) {
    const me = await this.participant(userId, chatId);
    if (me.isMuted) throw new ForbiddenException('You are muted in this chat');

    const sendAt = new Date(dto.sendAt);
    const now = Date.now();
    if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < now + 30_000) {
      throw new BadRequestException('Pick a time at least a minute from now');
    }
    if (sendAt.getTime() > now + MAX_SCHEDULE_AHEAD_MS) {
      throw new BadRequestException('You can schedule up to a year ahead');
    }
    if (!dto.content?.trim() && !dto.mediaUrl && !dto.fileUrl) {
      throw new BadRequestException('Write a message to schedule');
    }

    return this.prisma.scheduledMessage.create({
      data: {
        chatId,
        senderId: userId,
        content: dto.content?.trim() || null,
        type: (dto.type as MessageType) || MessageType.TEXT,
        mediaUrl: dto.mediaUrl || null,
        fileUrl: dto.fileUrl || null,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
        replyToId: dto.replyToId || null,
        sendAt,
      },
    });
  }

  async listScheduled(userId: string, chatId: string) {
    await this.participant(userId, chatId);
    return this.prisma.scheduledMessage.findMany({
      where: { chatId, senderId: userId },
      orderBy: { sendAt: 'asc' },
    });
  }

  async cancelScheduled(userId: string, scheduledId: string) {
    const scheduled = await this.prisma.scheduledMessage.findUnique({ where: { id: scheduledId } });
    if (!scheduled || scheduled.senderId !== userId) throw new NotFoundException('Scheduled message not found');
    await this.prisma.scheduledMessage.delete({ where: { id: scheduledId } });
    return { id: scheduledId, chatId: scheduled.chatId };
  }

  /**
   * Sends scheduled messages that are due. Each row is deleted first (claimed),
   * so a message is never sent twice even if two server processes run this.
   */
  async sendDueScheduled() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: { sendAt: { lte: new Date() } },
      orderBy: { sendAt: 'asc' },
      take: 50,
    });
    const results: Array<{ scheduledId: string; chatId: string; senderId: string; message?: any; error?: string }> = [];
    for (const row of due) {
      const claimed = await this.prisma.scheduledMessage.deleteMany({ where: { id: row.id } });
      if (!claimed.count) continue;
      try {
        const message = await this.chatService.sendMessage(row.senderId, {
          chatId: row.chatId,
          content: row.content ?? '',
          type: row.type,
          mediaUrl: row.mediaUrl ?? undefined,
          fileUrl: row.fileUrl ?? undefined,
          replyToId: row.replyToId ?? undefined,
          metadata: metaOf(row),
        });
        results.push({ scheduledId: row.id, chatId: row.chatId, senderId: row.senderId, message });
      } catch (error: any) {
        this.logger.warn(`Scheduled message ${row.id} failed: ${error?.message || error}`);
        results.push({ scheduledId: row.id, chatId: row.chatId, senderId: row.senderId, error: error?.message || 'Failed' });
      }
    }
    return results;
  }

  // ============ DELIVERY ============

  /** Recipient's device connected: their undelivered messages (last 30 days) are delivered */
  async markDeliveredFor(userId: string) {
    const where: Prisma.MessageWhereInput = {
      chat: { participants: { some: { userId } } },
      senderId: { not: userId },
      deliveredAt: null,
      isDeleted: false,
      createdAt: { gt: new Date(Date.now() - 30 * 24 * 3600_000) },
    };
    const pending = await this.prisma.message.groupBy({ by: ['chatId'], where });
    if (!pending.length) return { at: new Date(), chatIds: [] as string[] };
    const at = new Date();
    await this.prisma.message.updateMany({ where, data: { deliveredAt: at } });
    return { at, chatIds: pending.map((p) => p.chatId).filter(Boolean) as string[] };
  }

  async markDelivered(messageId: string) {
    const at = new Date();
    await this.prisma.message.updateMany({ where: { id: messageId, deliveredAt: null }, data: { deliveredAt: at } });
    return at;
  }

  // ============ LINK PREVIEWS ============

  /** Adds a preview card to a text message with a link; null when there's nothing to add */
  async attachLinkPreview(messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.type !== MessageType.TEXT) return null;
    const url = firstUrl(message.content);
    if (!url) return null;

    const preview = await this.linkPreviews.preview(url);
    if (!preview) return null;

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: { ...metaOf(message), linkPreview: { ...preview } } },
      include: MESSAGE_INCLUDE,
    });
    return presentMessage(updated);
  }

  // ============ VOICE TRANSCRIPTION ============

  async transcribe(userId: string, messageId: string) {
    const message = await this.accessibleMessage(userId, messageId);
    if (message.type !== MessageType.VOICE_NOTE && message.type !== MessageType.AUDIO) {
      throw new BadRequestException('Only voice messages can be transcribed');
    }
    const meta = metaOf(message);
    if (meta.transcript?.text) return { messageId, ...meta.transcript };
    if (!message.mediaUrl) throw new GoneException('The audio for this message is no longer available');

    const deepgram = this.getDeepgram();
    const response: any = await deepgram.listen.v1.media.transcribeUrl({
      url: message.mediaUrl,
      model: 'nova-2',
      smart_format: true,
      detect_language: true,
    });
    const channel = response?.results?.channels?.[0];
    const text: string = channel?.alternatives?.[0]?.transcript?.trim() || '';
    if (!text) throw new BadRequestException("Couldn't hear any words in this voice message");

    const transcript = { text, language: channel?.detected_language || null };
    await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: { ...meta, transcript } },
    });
    return { messageId, ...transcript };
  }

  /** Translates a voice message's transcript into the user's native language */
  async translateTranscript(userId: string, messageId: string) {
    const message = await this.accessibleMessage(userId, messageId);
    const meta = metaOf(message);
    if (!meta.transcript?.text) throw new BadRequestException('Transcribe the voice message first');

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { nativeLanguage: true },
    });
    const language = profile?.nativeLanguage || 'English';
    const cached = meta.transcriptTranslations?.[language];
    if (cached) return { messageId, language, text: cached };

    const openai = this.getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: `Translate the user's text into ${language}. Reply with the translation only.` },
        { role: 'user', content: meta.transcript.text },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    if (!text) throw new BadRequestException('Translation failed');

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: { ...meta, transcriptTranslations: { ...(meta.transcriptTranslations ?? {}), [language]: text } },
      },
    });
    return { messageId, language, text };
  }

  private getDeepgram() {
    if (this.deepgram) return this.deepgram;
    const apiKey = this.config.get<string>('DEEPGRAM_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Voice transcription is not set up yet (add DEEPGRAM_API_KEY to server/.env).');
    }
    this.deepgram = new DeepgramClient({ apiKey });
    return this.deepgram;
  }

  private getOpenAI() {
    if (this.openai) return this.openai;
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Translation is not set up yet (add OPENAI_API_KEY to server/.env).');
    }
    this.openai = new OpenAI({ apiKey });
    return this.openai;
  }

  // ============ REPORT ============

  async report(
    userId: string,
    dto: { targetType: 'USER' | 'MESSAGE'; targetId: string; reason: string; description?: string },
  ) {
    if (dto.targetType === 'USER') {
      if (dto.targetId === userId) throw new BadRequestException("You can't report yourself");
      const target = await this.prisma.user.findUnique({ where: { id: dto.targetId }, select: { id: true } });
      if (!target) throw new NotFoundException('User not found');
    } else {
      await this.accessibleMessage(userId, dto.targetId);
    }
    await this.prisma.report.create({
      data: {
        reportedById: userId,
        targetId: dto.targetId,
        targetType: dto.targetType,
        reason: dto.reason.trim(),
        description: dto.description?.trim() || null,
      },
    });
    return { ok: true };
  }
}
