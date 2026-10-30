import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChatDto, SendMessageDto, GetMessagesDto } from './dto/chat.dto';
import { MessageType, Prisma } from '@prisma/client';
import { ActivityService, XP_REWARDS, CHAT_XP_DAILY_CAP } from '../learning/activity.service';
import { ChatPrivacyService } from './chat-privacy.service';
import { MESSAGE_INCLUDE, metaOf, presentMessage, visibleMessagesWhere } from './chat.presenter';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** FILE messages keep the original name / size / type so the bubble can show them */
function fileMetadata(meta?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number> = {};
  if (typeof meta.fileName === 'string' && meta.fileName.trim()) {
    out.fileName = meta.fileName.trim().slice(0, 255);
  }
  if (typeof meta.mimeType === 'string' && meta.mimeType) {
    out.mimeType = meta.mimeType.slice(0, 100);
  }
  const size = Number(meta.fileSize);
  if (Number.isFinite(size) && size > 0) out.fileSize = Math.round(size);
  return Object.keys(out).length ? out : undefined;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private privacy: ChatPrivacyService,
  ) {}

  // ============ CHATS ============

  async getUserChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                // "Active now / last seen" in the chat header and list
                profile: { select: { lastActive: true, nativeLanguage: true, learningLanguages: true } },
              },
            },
          },
        },
        // A few, because "clear history" is per chat and filtered below
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          where: visibleMessagesWhere(userId),
          include: {
            sender: { select: { id: true, name: true } },
            readReceipts: { select: { userId: true, readAt: true } },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Unread = visible messages from others after my last read
    const unreadCounts = await Promise.all(
      chats.map((chat) => {
        const me = chat.participants.find((p) => p.userId === userId);
        return this.prisma.message.count({
          where: {
            chatId: chat.id,
            senderId: { not: userId },
            ...visibleMessagesWhere(userId, me?.clearedAt),
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        });
      }),
    );

    const shaped = chats.map((chat, i) => {
      const me = chat.participants.find((p) => p.userId === userId);
      const last = chat.messages.find((m) => !me?.clearedAt || m.createdAt > me.clearedAt);
      return {
        ...chat,
        // A locked chat shows no preview until it's opened with the PIN
        messages: last && !me?.isLocked ? [presentMessage(last)] : [],
        unreadCount: unreadCounts[i],
        ...this.myChatState(me),
      };
    });

    return this.hideLastSeen(shaped, userId);
  }

  /** My per-user state for a chat (pinned / archived / muted / locked) */
  private myChatState(
    me?: { isPinned: boolean; isArchived: boolean; mutedUntil: Date | null; isLocked: boolean } | null,
  ) {
    return {
      isPinned: me?.isPinned ?? false,
      isArchived: me?.isArchived ?? false,
      mutedUntil: me?.mutedUntil ?? null,
      isLocked: me?.isLocked ?? false,
    };
  }

  /** "Last seen" is mutual: hidden when the other person hides theirs or you hide yours */
  private async hideLastSeen<
    T extends { participants: Array<{ userId: string; user: { profile?: { lastActive: Date | null } | null } }> },
  >(chats: T[], viewerId: string): Promise<T[]> {
    const ids = chats.flatMap((c) => c.participants.map((p) => p.userId));
    const privacy = await this.privacy.getMany([viewerId, ...ids]);
    const viewerShows = privacy.get(viewerId)?.showLastSeen !== false;
    return chats.map((chat) => ({
      ...chat,
      participants: chat.participants.map((p) => {
        if (p.userId === viewerId || !p.user?.profile) return p;
        if (viewerShows && privacy.get(p.userId)?.showLastSeen !== false) return p;
        return { ...p, user: { ...p.user, profile: { ...p.user.profile, lastActive: null } } };
      }),
    }));
  }

  async getChatById(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                profile: { select: { lastActive: true, nativeLanguage: true, learningLanguages: true } },
              },
            },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    const me = chat.participants.find((p) => p.userId === userId);
    if (!me)
      throw new ForbiddenException('You are not a participant in this chat');

    const [shaped] = await this.hideLastSeen([chat], userId);
    return { ...shaped, ...this.myChatState(me) };
  }

  async createPrivateChat(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot create a chat with yourself');
    }

    await this.assertNotBlocked(userId, otherUserId);

    const existing = await this.prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (existing) return existing;

    return this.prisma.chat.create({
      data: {
        type: 'PRIVATE',
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async createGroupChat(userId: string, data: CreateChatDto) {
    const otherIds = data.participantIds.filter((id) => id !== userId);

    // Check if any participants are blocked
    for (const otherId of otherIds) {
      await this.assertNotBlocked(userId, otherId);
    }

    return this.prisma.chat.create({
      data: {
        type: 'GROUP',
        name: data.name || 'Group Chat',
        ownerId: userId,
        participants: {
          create: [
            { userId, role: 'ADMIN' },
            ...otherIds.map((id) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async addParticipants(chatId: string, userId: string, userIds: string[]) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type !== 'GROUP')
      throw new BadRequestException(
        'Only group chats can have participants added',
      );

    const isAdmin = chat.participants.some(
      (p) => p.userId === userId && (p.role === 'ADMIN' || p.role === 'OWNER'),
    );
    if (!isAdmin)
      throw new ForbiddenException('Only admins can add participants');

    // Check if any new participants are blocked
    for (const newUserId of userIds) {
      await this.assertNotBlocked(userId, newUserId);
    }

    const existingIds = chat.participants.map((p) => p.userId);
    const newIds = userIds.filter((id) => !existingIds.includes(id));

    if (newIds.length === 0) return chat;

    return this.prisma.chat.update({
      where: { id: chatId },
      data: {
        participants: {
          create: newIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async removeParticipant(
    chatId: string,
    userId: string,
    targetUserId: string,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type !== 'GROUP')
      throw new BadRequestException('Only group chats can remove participants');

    const isAdmin = chat.participants.some(
      (p) => p.userId === userId && (p.role === 'ADMIN' || p.role === 'OWNER'),
    );
    if (!isAdmin && userId !== targetUserId) {
      throw new ForbiddenException(
        'Only admins or the user themselves can remove a participant',
      );
    }

    await this.prisma.chatParticipant.delete({
      where: {
        chatId_userId: {
          chatId,
          userId: targetUserId,
        },
      },
    });

    return this.getChatById(chatId, userId);
  }

  // ============ MESSAGES ============

  async getMessages(userId: string, dto: GetMessagesDto) {
    if (!dto.chatId) {
      throw new BadRequestException('chatId is required');
    }
    const chatId = dto.chatId;
    const { limit = '50', before } = dto;
    const take = parseInt(limit, 10) || 50;

    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!participant)
      throw new ForbiddenException('You are not a participant in this chat');

    const where: Prisma.MessageWhereInput = {
      chatId,
      ...visibleMessagesWhere(userId, participant.clearedAt),
    };
    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const [messages, privacy] = await Promise.all([
      this.prisma.message.findMany({
        where,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          ...MESSAGE_INCLUDE,
          savedBy: { where: { userId }, select: { id: true } },
        },
      }),
      this.privacy.get(userId),
    ]);

    // Return in chronological order (oldest first) for frontend display
    return messages.reverse().map(({ savedBy, ...message }) =>
      presentMessage({
        ...message,
        isSaved: savedBy.length > 0,
        // Read receipts are mutual: turn yours off and you don't see other people's
        readReceipts: privacy.sendReadReceipts
          ? message.readReceipts
          : message.readReceipts.filter((r) => r.userId === userId),
      }),
    );
  }

  /** `forwardedFromId` is set only by forwarding (never taken from the client) */
  async sendMessage(
    userId: string,
    dto: SendMessageDto,
    options?: { forwardedFromId?: string },
  ) {
    const { chatId, communityId, content, type, replyToId } = dto;
    // An album: the first item also fills mediaUrl so older clients still show something
    const attachments =
      type === 'IMAGE' || type === 'VIDEO' ? (dto.attachments ?? []).slice(0, 10) : [];
    const mediaUrl = dto.mediaUrl || attachments[0]?.url;
    const fileUrl = dto.fileUrl || (attachments.length ? mediaUrl : undefined);

    if (!chatId && !communityId) {
      throw new BadRequestException('Either chatId or communityId is required');
    }

    if (!content && !mediaUrl && !fileUrl) {
      throw new BadRequestException(
        'Message must have content, media, or a file',
      );
    }

    if (communityId) {
      return this.sendCommunityMessage(userId, communityId, dto);
    }

    // Validate chat participation
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId: chatId!,
          userId,
        },
      },
    });

    if (!participant)
      throw new ForbiddenException('You are not a participant in this chat');

    // Check if the user is muted in this chat
    if (participant.isMuted) {
      throw new ForbiddenException('You are muted in this chat');
    }

    // Check block status for all participants in group chats
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: { include: { user: { select: { id: true, name: true } } } } },
    });

    if (chat) {
      // For private chats, check specific block
      if (chat.type === 'PRIVATE') {
        const other = chat.participants.find((p) => p.userId !== userId);
        if (other) await this.assertNotBlocked(userId, other.userId);
      } else {
        // For group chats, check if the user is blocked by anyone
        const otherParticipants = chat.participants.filter(
          (p) => p.userId !== userId,
        );
        for (const other of otherParticipants) {
          await this.assertNotBlocked(userId, other.userId);
        }
      }
    }

    // Validate reply
    let replyMessage: { chatId: string | null; senderId: string; content: string | null; isDeleted: boolean } | null = null;
    if (replyToId) {
      replyMessage = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { chatId: true, senderId: true, content: true, isDeleted: true },
      });
      if (!replyMessage || replyMessage.chatId !== chatId) {
        throw new BadRequestException('Invalid reply message');
      }
    }

    // A correction rewrites someone else's message (replyToId) — HelloTalk-style
    const isCorrection = type === 'CORRECTION';
    let metadata: Prisma.InputJsonValue | undefined;
    if (isCorrection) {
      if (!replyMessage || replyMessage.isDeleted) {
        throw new BadRequestException('Choose a message to correct');
      }
      if (replyMessage.senderId === userId) {
        throw new BadRequestException("You can't correct your own message");
      }
      const corrected = (content || '').trim();
      if (!corrected || corrected === (replyMessage.content || '').trim()) {
        throw new BadRequestException('Change something to make a correction');
      }
      const note = typeof dto.metadata?.note === 'string' ? dto.metadata.note.trim().slice(0, 300) : '';
      metadata = note ? { note } : {};
    } else if (type === 'VOICE_NOTE' || type === 'AUDIO') {
      // Browser-recorded WebM often has no duration header; keep the recorded length
      const duration = Number(dto.metadata?.duration);
      if (Number.isFinite(duration) && duration > 0) {
        metadata = { duration: Math.min(Math.round(duration), 60 * 60) };
      }
    } else if (type === 'FILE') {
      metadata = fileMetadata(dto.metadata);
    }

    const extra: Record<string, unknown> = {};
    if (options?.forwardedFromId) extra.forwarded = true;
    // @mentions in groups: "@Name" of another member
    if (chat && chat.type !== 'PRIVATE' && content?.includes('@')) {
      const mentions = chat.participants
        .filter((p) => p.userId !== userId && p.user?.name)
        .filter((p) => new RegExp(`@${escapeRegExp(p.user.name)}(?![\\w])`, 'i').test(content))
        .map((p) => p.userId);
      if (mentions.length) extra.mentions = mentions;
    }
    if (Object.keys(extra).length) {
      metadata = { ...((metadata as Record<string, unknown> | undefined) ?? {}), ...extra } as Prisma.InputJsonValue;
    }

    // Only voice notes get the "Voice message" placeholder; a file without a caption is
    // named after the file; photos and videos may have no caption at all
    const fallbackContent =
      type === 'FILE'
        ? ((metadata as { fileName?: string } | undefined)?.fileName ?? 'File')
        : !type || type === 'VOICE_NOTE' || type === 'AUDIO'
          ? 'Voice message'
          : '';

    // Disappearing messages: the chat's timer applies to every new message
    const expiresAt = chat?.disappearingSeconds
      ? new Date(Date.now() + chat.disappearingSeconds * 1000)
      : null;

    // Create message
    const message = await this.prisma.message.create({
      data: {
        chatId: chatId!,
        senderId: userId,
        content: isCorrection ? (content || '').trim().slice(0, 2000) : content || fallbackContent,
        type: (type as MessageType) || MessageType.VOICE_NOTE,
        mediaUrl: mediaUrl || null,
        fileUrl: fileUrl || null,
        replyToId: replyToId || null,
        isViewOnce: Boolean(dto.isViewOnce) && (type === 'IMAGE' || type === 'VIDEO'),
        expiresAt,
        forwardedFromId: options?.forwardedFromId ?? null,
        ...(metadata !== undefined ? { metadata } : {}),
        ...(attachments.length
          ? {
              attachments: {
                create: attachments.map((a) => ({
                  type: a.type,
                  url: a.url,
                  filename: (a.filename || 'attachment').slice(0, 255),
                  mimeType: a.mimeType ?? null,
                  size: Math.max(0, Math.round(a.size || 0)),
                })),
              },
            }
          : {}),
      },
      include: MESSAGE_INCLUDE,
    });

    // Update chat timestamp
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    if (isCorrection) {
      await this.activity.recordActivity(userId, XP_REWARDS.correctionGiven, 'CORRECTION_GIVEN');
    } else if (!options?.forwardedFromId && (message.type === 'TEXT' || message.type === 'VOICE_NOTE')) {
      // Chatting is practice too: small XP per message, capped per day
      await this.activity.recordCappedActivity(userId, XP_REWARDS.chatMessage, 'CHAT_MESSAGE', CHAT_XP_DAILY_CAP);
    }

    // Create read receipt for sender
    await this.prisma.readReceipt.create({
      data: {
        messageId: message.id,
        userId,
        readAt: new Date(),
      },
    });

    return presentMessage(message);
  }

  // ============ COMMUNITY MESSAGES ============

  async sendCommunityMessage(
    userId: string,
    communityId: string,
    dto: SendMessageDto,
  ) {
    const { content, type, mediaUrl, fileUrl, replyToId } = dto;

    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this community');
    }

    // Check if user is muted in community
    if (member.isMuted) {
      throw new ForbiddenException('You are muted in this community');
    }

    // Validate reply
    if (replyToId) {
      const replyMessage = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { communityId: true },
      });
      if (!replyMessage || replyMessage.communityId !== communityId) {
        throw new BadRequestException('Invalid reply message');
      }
    }

    let messageType: MessageType = MessageType.TEXT;

    if (type === 'IMAGE') {
      messageType = MessageType.IMAGE;
    } else if (type === 'VIDEO') {
      messageType = MessageType.VIDEO;
    } else if (type === 'VOICE_NOTE') {
      messageType = MessageType.VOICE_NOTE;
    } else if (type === 'AUDIO') {
      messageType = MessageType.AUDIO;
    } else if (type === 'FILE') {
      messageType = MessageType.FILE;
    } else if (type === 'GIF') {
      messageType = MessageType.GIF;
    } else if (type === 'STICKER') {
      messageType = MessageType.STICKER;
    } else if (content && content.trim()) {
      messageType = MessageType.TEXT;
    }

    const message = await this.prisma.message.create({
      data: {
        communityId,
        senderId: userId,
        content,
        type: messageType,
        mediaUrl,
        fileUrl,
        replyToId,
        ...(messageType === MessageType.FILE && fileMetadata(dto.metadata)
          ? { metadata: fileMetadata(dto.metadata) }
          : {}),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        translations: true,
      },
    });

    await this.prisma.readReceipt.create({
      data: {
        messageId: message.id,
        userId,
        readAt: new Date(),
      },
    });

    return message;
  }

  async getCommunityMessages(
    userId: string,
    communityId: string,
    limit: number = 50,
    before?: string,
  ) {
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this community');
    }

    const where: any = { communityId, isDeleted: false };
    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        translations: true,
      },
    });

    return messages.reverse();
  }

  // ============ MESSAGE MANAGEMENT ============

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!message) throw new NotFoundException('Message not found');

    // Check if user can delete the message
    let canDelete = message.senderId === userId;

    // Check if user is admin/owner in chat
    if (!canDelete && message.chatId) {
      canDelete =
        message.chat?.participants.some(
          (p) =>
            p.userId === userId && (p.role === 'ADMIN' || p.role === 'OWNER'),
        ) || false;
    }

    // Check if user is admin/owner in community
    if (!canDelete && message.communityId) {
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: message.communityId,
            userId,
          },
        },
        select: { role: true },
      });
      canDelete = member?.role === 'ADMIN' || member?.role === 'OWNER';
    }

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this message',
      );
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: 'Message deleted',
        deletedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    if (trimmedContent === (message.content || '').trim()) {
      throw new BadRequestException('Nothing changed');
    }

    // Edit history: each earlier version with the time it was written (last 10)
    const metadata = metaOf(message);
    const history = Array.isArray(metadata.editHistory) ? metadata.editHistory : [];
    metadata.editHistory = [
      ...history,
      { content: message.content, at: (message.editedAt ?? message.createdAt).toISOString() },
    ].slice(-10);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: trimmedContent,
        isEdited: true,
        editedAt: new Date(),
        metadata,
      },
      include: MESSAGE_INCLUDE,
    });
    return presentMessage(updated);
  }

  async pinMessage(userId: string, messageId: string, pinned: boolean) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');

    let canPin = false;

    if (message.chatId) {
      const chat = await this.prisma.chat.findUnique({
        where: { id: message.chatId },
        include: { participants: true },
      });
      canPin =
        chat?.participants.some(
          (p) =>
            p.userId === userId && (p.role === 'ADMIN' || p.role === 'OWNER'),
        ) || false;
    } else if (message.communityId) {
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: message.communityId,
            userId,
          },
        },
        select: { role: true },
      });
      canPin = member?.role === 'ADMIN' || member?.role === 'OWNER';
    }

    if (!canPin) {
      throw new ForbiddenException(
        'You do not have permission to pin messages',
      );
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isPinned: pinned },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        translations: true,
      },
    });
  }

  // ============ REACTIONS ============

  async addReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true, communityId: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    await this.validateMessageAccess(userId, message);

    const existing = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (existing) {
      if (existing.emoji === emoji) {
        await this.prisma.reaction.delete({
          where: { id: existing.id },
        });

        const updatedMessage = await this.prisma.message.findUnique({
          where: { id: messageId },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            replyTo: {
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            attachments: true,
            translations: true,
          },
        });

        return {
          removed: true,
          message: updatedMessage,
        };
      } else {
        const reaction = await this.prisma.reaction.update({
          where: { id: existing.id },
          data: { emoji },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        });

        const updatedMessage = await this.prisma.message.findUnique({
          where: { id: messageId },
          include: {
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        return {
          reaction,
          message: updatedMessage,
        };
      }
    }

    const reaction = await this.prisma.reaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const updatedMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return {
      reaction,
      message: updatedMessage,
    };
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    const reaction = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    await this.prisma.reaction.delete({
      where: { id: reaction.id },
    });

    const updatedMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        translations: true,
      },
    });

    return {
      success: true,
      message: updatedMessage,
    };
  }

  // ============ CORRECTIONS ============

  /** The corrected person accepts a correction: stamps it once and awards XP */
  async acceptCorrection(userId: string, messageId: string) {
    const correction = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chatId: true,
        type: true,
        metadata: true,
        replyTo: { select: { senderId: true } },
      },
    });
    if (!correction || correction.type !== 'CORRECTION' || !correction.chatId) {
      throw new NotFoundException('Correction not found');
    }
    if (correction.replyTo?.senderId !== userId) {
      throw new ForbiddenException('Only the person who was corrected can accept it');
    }

    const previous = (correction.metadata ?? {}) as Record<string, unknown>;
    if (previous.acceptedAt) {
      return { messageId, chatId: correction.chatId, metadata: previous };
    }

    const metadata = { ...previous, acceptedAt: new Date().toISOString() };
    await this.prisma.message.update({
      where: { id: messageId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
    await this.activity.recordActivity(userId, XP_REWARDS.correctionAccepted, 'CORRECTION_ACCEPTED');
    return { messageId, chatId: correction.chatId, metadata };
  }

  // ============ READ RECEIPTS ============

  async markMessageRead(userId: string, chatId: string, messageId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!participant)
      throw new ForbiddenException('You are not a participant in this chat');

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true, createdAt: true },
    });
    if (!message || message.chatId !== chatId) {
      throw new BadRequestException('Message does not belong to this chat');
    }

    // Everything up to this message is now read (drives unread counts)
    if (message.createdAt > participant.lastReadAt) {
      await this.prisma.chatParticipant.update({
        where: { chatId_userId: { chatId, userId } },
        data: { lastReadAt: message.createdAt },
      });
    }

    // Read receipts off: unread counts still clear, but nobody sees "Seen"
    if (!(await this.privacy.get(userId)).sendReadReceipts) return null;

    const receipt = await this.prisma.readReceipt.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (!receipt) {
      return this.prisma.readReceipt.create({
        data: {
          messageId,
          userId,
          readAt: new Date(),
        },
      });
    }

    return receipt;
  }

  async getReadReceipts(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true, communityId: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    await this.validateMessageAccess(userId, message);

    return this.prisma.readReceipt.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // ============ UNREAD COUNT ============

  async getUnreadCount(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      select: {
        id: true,
        messages: {
          where: {
            isDeleted: false,
            NOT: {
              senderId: userId,
            },
            readReceipts: {
              none: {
                userId,
              },
            },
          },
        },
      },
    });

    return chats.map((chat) => ({
      chatId: chat.id,
      count: chat.messages.length,
    }));
  }

  async getUnreadCountForChat(userId: string, chatId: string) {
    const count = await this.prisma.message.count({
      where: {
        chatId,
        isDeleted: false,
        NOT: {
          senderId: userId,
        },
        readReceipts: {
          none: {
            userId,
          },
        },
      },
    });

    return { chatId, count };
  }

  // ============ SEARCH ============

  async searchMessages(userId: string, chatId: string, query: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!participant)
      throw new ForbiddenException('You are not a participant in this chat');

    return this.prisma.message.findMany({
      where: {
        chatId,
        isDeleted: false,
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async searchCommunityMessages(
    userId: string,
    communityId: string,
    query: string,
  ) {
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this community');
    }

    return this.prisma.message.findMany({
      where: {
        communityId,
        isDeleted: false,
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // ============ HELPERS ============

  private async assertNotBlocked(userId: string, otherUserId: string) {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException('Cannot interact with this user');
    }
  }

  private async validateMessageAccess(
    userId: string,
    message: { chatId?: string | null; communityId?: string | null },
  ) {
    if (message.chatId) {
      const participant = await this.prisma.chatParticipant.findUnique({
        where: {
          chatId_userId: {
            chatId: message.chatId,
            userId,
          },
        },
      });
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    } else if (message.communityId) {
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: message.communityId,
            userId,
          },
        },
      });
      if (!member) {
        throw new ForbiddenException('You are not a member of this community');
      }
    }
  }
}
