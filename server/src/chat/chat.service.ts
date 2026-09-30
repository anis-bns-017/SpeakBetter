import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChatDto, SendMessageDto, GetMessagesDto } from './dto/chat.dto';
import { MessageType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ============ CHATS ============

  async getUserChats(userId: string) {
    return this.prisma.chat.findMany({
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
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where: { isDeleted: false },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
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
              },
            },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    const isParticipant = chat.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new ForbiddenException('You are not a participant in this chat');

    return chat;
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

    const where: any = { chatId, isDeleted: false };
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
      take,
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

    // Return in chronological order (oldest first) for frontend display
    return messages.reverse();
  }

  async sendMessage(userId: string, dto: SendMessageDto) {
    const { chatId, communityId, content, type, mediaUrl, fileUrl, replyToId } =
      dto;

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
      include: { participants: true },
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
    if (replyToId) {
      const replyMessage = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { chatId: true },
      });
      if (!replyMessage || replyMessage.chatId !== chatId) {
        throw new BadRequestException('Invalid reply message');
      }
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        chatId: chatId!,
        senderId: userId,
        content: content || 'Voice message',
        type: (type as MessageType) || MessageType.VOICE_NOTE,
        mediaUrl: mediaUrl || null,
        fileUrl: fileUrl || null,
        replyToId: replyToId || null,
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

    // Update chat timestamp
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    // Create read receipt for sender
    await this.prisma.readReceipt.create({
      data: {
        messageId: message.id,
        userId,
        readAt: new Date(),
      },
    });

    return message;
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

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: trimmedContent,
        isEdited: true,
        editedAt: new Date(),
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
      select: { chatId: true },
    });
    if (!message || message.chatId !== chatId) {
      throw new BadRequestException('Message does not belong to this chat');
    }

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
