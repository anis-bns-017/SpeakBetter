import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  SendFriendRequestDto,
  RespondFriendRequestDto,
  BlockUserDto,
} from './dto/friend-request.dto';
import { rankSuggestions } from './friend-suggestions';

/** How many recently active people are scored before the best few are returned */
const SUGGESTION_CANDIDATE_POOL = 200;

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  // ============ FRIEND REQUESTS ============

  async sendFriendRequest(userId: string, dto: SendFriendRequestDto) {
    const { toUserId } = dto;

    if (userId === toUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already friends
    const existingFriend = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId },
          { fromUserId: toUserId, toUserId: userId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (existingFriend) {
      throw new ConflictException('Already friends with this user');
    }

    // Check if request already exists
    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId },
          { fromUserId: toUserId, toUserId: userId },
        ],
        status: 'PENDING',
      },
    });
    if (existingRequest) {
      throw new ConflictException('Friend request already exists');
    }

    // Check if blocked
    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: toUserId },
          { blockerId: toUserId, blockedId: userId },
        ],
      },
    });
    if (blocked) {
      throw new BadRequestException(
        'You cannot send a friend request to this user',
      );
    }

    return this.prisma.friendRequest.create({
      data: {
        fromUserId: userId,
        toUserId,
        status: 'PENDING',
      },
    });
  }

  async respondFriendRequest(userId: string, dto: RespondFriendRequestDto) {
    const { requestId, action } = dto;

    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.toUserId !== userId) {
      throw new BadRequestException(
        'You are not the recipient of this request',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This request has already been responded to',
      );
    }

    if (action === 'accepted') {
      // Update request status
      await this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      // Create friend relationship
      await this.prisma.friend.create({
        data: {
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
          status: 'ACCEPTED',
        },
      });

      return { message: 'Friend request accepted' };
    } else {
      // Reject
      await this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });

      return { message: 'Friend request rejected' };
    }
  }

  async cancelFriendRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.fromUserId !== userId) {
      throw new BadRequestException('You are not the sender of this request');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This request has already been responded to',
      );
    }

    await this.prisma.friendRequest.delete({
      where: { id: requestId },
    });

    return { message: 'Friend request cancelled' };
  }

  // ============ FRIEND LIST ============

  async getFriends(userId: string) {
    const friends = await this.prisma.friend.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        status: 'ACCEPTED',
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                nativeLanguage: true,
                learningLanguages: true,
                lastActive: true,
              },
            },
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                nativeLanguage: true,
                learningLanguages: true,
                lastActive: true,
              },
            },
          },
        },
      },
    });

    // Format response: return the friend user object
    return friends.map((friend) => {
      const friendUser =
        friend.fromUserId === userId ? friend.toUser : friend.fromUser;
      return {
        ...friendUser,
        friendSince: friend.createdAt,
      };
    });
  }

  async getFriendRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        toUserId: userId,
        status: 'PENDING',
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  async getSentFriendRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        fromUserId: userId,
        status: 'PENDING',
      },
      include: {
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  // ============ BLOCKING ============

  async blockUser(userId: string, dto: BlockUserDto) {
    const { userId: targetUserId, reason } = dto;

    if (userId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already blocked
    const existing = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: targetUserId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('User already blocked');
    }

    // Remove friend relationship if exists
    await this.prisma.friend.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: userId },
        ],
      },
    });

    // Remove friend requests
    await this.prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: userId },
        ],
      },
    });

    // Create block
    return this.prisma.block.create({
      data: {
        blockerId: userId,
        blockedId: targetUserId,
        reason,
      },
    });
  }

  async unblockUser(userId: string, targetUserId: string) {
    const block = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: targetUserId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: targetUserId,
        },
      },
    });

    return { message: 'User unblocked' };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => ({
      ...block.blocked,
      blockedAt: block.createdAt,
      reason: block.reason,
    }));
  }

  // ============ SEARCH ============

  async searchUsers(userId: string, query: string, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          { id: { not: userId } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        profile: {
          select: {
            nativeLanguage: true,
            learningLanguages: true,
          },
        },
      },
      take: limit,
    });

    // For each result, check friendship status
    const results = await Promise.all(
      users.map(async (user) => {
        const isFriend = await this.prisma.friend.findFirst({
          where: {
            OR: [
              { fromUserId: userId, toUserId: user.id },
              { fromUserId: user.id, toUserId: userId },
            ],
            status: 'ACCEPTED',
          },
        });

        const isRequested = await this.prisma.friendRequest.findFirst({
          where: {
            OR: [
              { fromUserId: userId, toUserId: user.id },
              { fromUserId: user.id, toUserId: userId },
            ],
            status: 'PENDING',
          },
        });

        const isBlocked = await this.prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: user.id },
              { blockerId: user.id, blockedId: userId },
            ],
          },
        });

        return {
          ...user,
          isFriend: !!isFriend,
          isRequested: !!isRequested,
          isBlocked: !!isBlocked,
        };
      }),
    );

    return results;
  }

  // ============ SUGGESTIONS ============

  /**
   * People to practice with, best language-exchange match first. Leaves out friends,
   * anyone with a pending request either way, blocks either way, and people who turned
   * off friend requests or their public profile.
   */
  async getSuggestions(userId: string, limit = 20) {
    const take = Math.min(Math.max(Math.floor(limit) || 20, 1), 50);

    const [me, friends, requests, blocks] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          nativeLanguage: true,
          learningLanguages: true,
          interests: true,
        },
      }),
      this.prisma.friend.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { fromUserId: true, toUserId: true },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
          status: 'PENDING',
        },
        select: { fromUserId: true, toUserId: true },
      }),
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);

    const excluded = new Set<string>([userId]);
    for (const f of friends) excluded.add(f.fromUserId).add(f.toUserId);
    for (const r of requests) excluded.add(r.fromUserId).add(r.toUserId);
    for (const b of blocks) excluded.add(b.blockerId).add(b.blockedId);

    // Rank among the most recently active people rather than the whole user table
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { notIn: [...excluded] },
        profile: { isNot: null },
        OR: [
          { settings: { is: null } },
          {
            settings: {
              is: { allowFriendRequests: true, showProfilePublic: true },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        profile: {
          select: {
            nativeLanguage: true,
            learningLanguages: true,
            interests: true,
            country: true,
            level: true,
            lastActive: true,
          },
        },
      },
      orderBy: { profile: { lastActive: 'desc' } },
      take: SUGGESTION_CANDIDATE_POOL,
    });

    return rankSuggestions(me, candidates, take);
  }

  // ============ ONLINE STATUS (Basic) ============

  async getOnlineStatus(userId: string) {
    // Simple implementation: check if user has been active in the last 5 minutes
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { lastActive: true },
    });

    if (!profile) {
      return { online: false };
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const online = profile.lastActive > fiveMinutesAgo;

    return { online, lastActive: profile.lastActive };
  }

  async updateLastActive(userId: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { lastActive: new Date() },
    });
  }

  // ============ HELPERS ============

  async checkFriendship(userId1: string, userId2: string) {
    const friend = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { fromUserId: userId1, toUserId: userId2 },
          { fromUserId: userId2, toUserId: userId1 },
        ],
        status: 'ACCEPTED',
      },
    });

    return !!friend;
  }

  async getFriendCount(userId: string) {
    return this.prisma.friend.count({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        status: 'ACCEPTED',
      },
    });
  }
}
