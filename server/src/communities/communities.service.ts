import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateChannelDto,
  UpdateChannelDto,
  CreateThreadDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  BanMemberDto,
  CreateInviteDto,
} from './dto/community.dto';
import { v4 as uuidv4 } from 'uuid';
import { CommunityMemberRole } from '@prisma/client';

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

  // ============ COMMUNITIES ============

  async createCommunity(userId: string, dto: CreateCommunityDto) {
    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        bannerUrl: dto.bannerUrl,
        type: dto.type,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: CommunityMemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        channels: true,
        roles: true,
      },
    });

    await this.createDefaultChannels(community.id);

    return this.getCommunityById(community.id, userId);
  }

  private async createDefaultChannels(communityId: string) {
    const defaultChannels = [
      { name: 'General', type: 'TEXT', description: 'General chat' },
      {
        name: 'Announcements',
        type: 'ANNOUNCEMENT',
        description: 'Important announcements',
      },
      { name: 'Voice', type: 'VOICE', description: 'Voice chat' },
    ];

    for (let i = 0; i < defaultChannels.length; i++) {
      await this.prisma.channel.create({
        data: {
          communityId,
          name: defaultChannels[i].name,
          type: defaultChannels[i].type as any,
          description: defaultChannels[i].description,
          position: i,
        },
      });
    }
  }

  async getCommunityById(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        channels: {
          orderBy: { position: 'asc' },
          include: {
            threads: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        roles: {
          orderBy: { position: 'asc' },
        },
        bans: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!community) throw new NotFoundException('Community not found');
    if (community.hiddenAt) throw new NotFoundException('This community has been hidden by moderators');

    const isMember = community.members.some((m) => m.userId === userId);
    if (!isMember && community.type !== 'PUBLIC') {
      throw new ForbiddenException('You do not have access to this community');
    }

    return community;
  }

  async getCommunities(userId: string) {
    const [owned, joined, publicCommunities] = await Promise.all([
      // Communities hidden by moderators (admin section) are left out of every list
      this.prisma.community.findMany({
        where: { ownerId: userId, hiddenAt: null },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { members: true, channels: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.community.findMany({
        where: {
          members: { some: { userId } },
          ownerId: { not: userId },
          hiddenAt: null,
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { members: true, channels: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.community.findMany({
        where: {
          type: 'PUBLIC',
          hiddenAt: null,
          NOT: {
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { members: true, channels: true },
          },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      owned,
      joined,
      recommended: publicCommunities,
    };
  }

  async updateCommunity(
    userId: string,
    communityId: string,
    dto: UpdateCommunityDto,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can update this community');
    }

    return this.prisma.community.update({
      where: { id: communityId },
      data: dto,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        channels: true,
        roles: true,
      },
    });
  }

  async deleteCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this community');
    }

    await this.prisma.community.delete({
      where: { id: communityId },
    });

    return { message: 'Community deleted successfully' };
  }

  // ============ CHANNELS ============

  async createChannel(
    userId: string,
    communityId: string,
    dto: CreateChannelDto,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only owners and admins can create channels',
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.channel.findUnique({
        where: { id: dto.parentId },
      });
      if (
        !parent ||
        parent.communityId !== communityId ||
        parent.type !== 'CATEGORY'
      ) {
        throw new BadRequestException('Invalid parent channel');
      }
    }

    return this.prisma.channel.create({
      data: {
        communityId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        parentId: dto.parentId,
        position: dto.position || 0,
      },
    });
  }

  async updateChannel(
    userId: string,
    communityId: string,
    channelId: string,
    dto: UpdateChannelDto,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.communityId !== communityId) {
      throw new NotFoundException('Channel not found');
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    const member = community?.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only owners and admins can update channels',
      );
    }

    return this.prisma.channel.update({
      where: { id: channelId },
      data: dto,
    });
  }

  async deleteChannel(userId: string, communityId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.communityId !== communityId) {
      throw new NotFoundException('Channel not found');
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    const member = community?.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only owners and admins can delete channels',
      );
    }

    await this.prisma.channel.delete({
      where: { id: channelId },
    });

    return { message: 'Channel deleted successfully' };
  }

  // ============ THREADS ============

  async createThread(userId: string, channelId: string, dto: CreateThreadDto) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { community: { include: { members: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== 'TEXT' && channel.type !== 'ANNOUNCEMENT') {
      throw new BadRequestException(
        'Threads can only be created in text channels',
      );
    }

    const member = channel.community.members.find((m) => m.userId === userId);
    if (!member)
      throw new ForbiddenException('You are not a member of this community');

    return this.prisma.thread.create({
      data: {
        channelId,
        title: dto.title,
        content: dto.content,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: true,
      },
    });
  }

  async getThreads(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { community: { include: { members: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const member = channel.community.members.find((m) => m.userId === userId);
    if (!member)
      throw new ForbiddenException('You are not a member of this community');

    return this.prisma.thread.findMany({
      where: { channelId },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getThreadById(threadId: string, userId: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        channel: {
          include: { community: { include: { members: true } } },
        },
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: {
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const member = thread.channel.community.members.find(
      (m) => m.userId === userId,
    );
    if (!member)
      throw new ForbiddenException('You are not a member of this community');

    return thread;
  }

  // ============ MEMBERS ============

  async joinCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true, bans: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const isBanned = community.bans.some((b) => b.userId === userId);
    if (isBanned)
      throw new ForbiddenException('You are banned from this community');

    const isMember = community.members.some((m) => m.userId === userId);
    if (isMember) throw new ConflictException('Already a member');

    if (community.type === 'PRIVATE') {
      throw new ForbiddenException('This community is private');
    }

    return this.prisma.communityMember.create({
      data: {
        communityId,
        userId,
        role: CommunityMemberRole.MEMBER,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async leaveCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community) throw new NotFoundException('Community not found');

    if (community.ownerId === userId) {
      throw new BadRequestException('Owner cannot leave the community');
    }

    await this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    return { message: 'Left community successfully' };
  }

  async addMember(userId: string, communityId: string, dto: AddMemberDto) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can add members');
    }

    const existing = community.members.find((m) => m.userId === dto.userId);
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.communityMember.create({
      data: {
        communityId,
        userId: dto.userId,
        role: (dto.role as CommunityMemberRole) || CommunityMemberRole.MEMBER,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async updateMemberRole(
    userId: string,
    communityId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can update roles');
    }

    if (targetUserId === community.ownerId) {
      throw new ForbiddenException("Cannot change the owner's role");
    }

    return this.prisma.communityMember.update({
      where: {
        communityId_userId: {
          communityId,
          userId: targetUserId,
        },
      },
      data: { role: dto.role as CommunityMemberRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(
    userId: string,
    communityId: string,
    targetUserId: string,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    if (targetUserId === community.ownerId) {
      throw new ForbiddenException('Cannot remove the owner');
    }

    await this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,
          userId: targetUserId,
        },
      },
    });

    return { message: 'Member removed successfully' };
  }

  // ============ ROLES ============

  async createRole(userId: string, communityId: string, dto: CreateRoleDto) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (!member || member.role !== CommunityMemberRole.OWNER) {
      throw new ForbiddenException('Only the owner can create roles');
    }

    const existingRole = await this.prisma.communityRole.findFirst({
      where: {
        communityId,
        name: dto.name,
      },
    });
    if (existingRole) throw new ConflictException('Role name already exists');

    return this.prisma.communityRole.create({
      data: {
        communityId,
        name: dto.name,
        color: dto.color,
        permissions: dto.permissions,
        position: dto.position,
      },
    });
  }

  async updateRole(
    userId: string,
    communityId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (!member || member.role !== CommunityMemberRole.OWNER) {
      throw new ForbiddenException('Only the owner can update roles');
    }

    return this.prisma.communityRole.update({
      where: { id: roleId },
      data: dto,
    });
  }

  async deleteRole(userId: string, communityId: string, roleId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (!member || member.role !== CommunityMemberRole.OWNER) {
      throw new ForbiddenException('Only the owner can delete roles');
    }

    await this.prisma.communityRole.delete({
      where: { id: roleId },
    });

    return { message: 'Role deleted successfully' };
  }

  // ============ BANS ============

  async banMember(userId: string, communityId: string, dto: BanMemberDto) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true, bans: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can ban members');
    }

    if (dto.userId === community.ownerId) {
      throw new ForbiddenException('Cannot ban the owner');
    }

    const existingBan = community.bans.some((b) => b.userId === dto.userId);
    if (existingBan) throw new ConflictException('User is already banned');

    await this.prisma.communityMember.deleteMany({
      where: {
        communityId,
        userId: dto.userId,
      },
    });

    return this.prisma.communityBan.create({
      data: {
        community: { connect: { id: communityId } },
        user: { connect: { id: dto.userId } },
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        // FIX: createdBy is a relation to User (via the "CommunityBanCreator"
        // relation on your schema), not a plain string column — must connect.
        createdBy: { connect: { id: userId } },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async unbanMember(userId: string, communityId: string, targetUserId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can unban members');
    }

    await this.prisma.communityBan.deleteMany({
      where: {
        communityId,
        userId: targetUserId,
      },
    });

    return { message: 'User unbanned successfully' };
  }

  // ============ INVITES ============

  async createInvite(
    userId: string,
    communityId: string,
    dto: CreateInviteDto,
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const member = community.members.find((m) => m.userId === userId);
    if (
      !member ||
      (member.role !== CommunityMemberRole.OWNER &&
        member.role !== CommunityMemberRole.ADMIN)
    ) {
      throw new ForbiddenException('Only owners and admins can create invites');
    }

    const code = uuidv4().slice(0, 8);

    return this.prisma.communityInvite.create({
      data: {
        communityId,
        code,
        maxUses: dto.maxUses || 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdBy: userId,
      },
    });
  }

  async joinByInvite(userId: string, code: string) {
    const invite = await this.prisma.communityInvite.findUnique({
      where: { code },
      include: { community: { include: { members: true, bans: true } } },
    });
    if (!invite) throw new NotFoundException('Invalid invite code');

    const community = invite.community;

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Invite has reached maximum uses');
    }

    const isBanned = community.bans.some((b) => b.userId === userId);
    if (isBanned)
      throw new ForbiddenException('You are banned from this community');

    const isMember = community.members.some((m) => m.userId === userId);
    if (isMember) throw new ConflictException('Already a member');

    await this.prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId,
        role: CommunityMemberRole.MEMBER,
      },
    });

    await this.prisma.communityInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });

    return this.getCommunityById(community.id, userId);
  }
}
