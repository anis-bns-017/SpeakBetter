import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CommunityMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateChannelDto,
  UpdateChannelDto,
  CreateThreadDto,
  CreateReplyDto,
  UpdateThreadDto,
  ReportPostDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  BanMemberDto,
  CreateInviteDto,
} from './dto/community.dto';

/** Who outranks whom: moderators look after posts, admins also look after people and channels */
const RANK: Record<CommunityMemberRole, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };
export const rankOf = (role: CommunityMemberRole | null | undefined) => (role ? RANK[role] : -1);

/** Roles the owner can hand out. There is only ever one owner. */
export const ASSIGNABLE_ROLES: CommunityMemberRole[] = ['ADMIN', 'MODERATOR', 'MEMBER'];
export const isAssignableRole = (role: unknown): role is CommunityMemberRole =>
  ASSIGNABLE_ROLES.includes(role as CommunityMemberRole);

/** Removing or banning someone needs admin rights and a higher role than theirs */
export const canManage = (actor: CommunityMemberRole, target: CommunityMemberRole) =>
  RANK[actor] >= RANK.ADMIN && RANK[actor] > RANK[target];

export const banIsActive = (ban: { expiresAt: Date | null }, now = new Date()) =>
  !ban.expiresAt || ban.expiresAt.getTime() > now.getTime();

const MAX_CHANNELS = 50;
const THREADS_SHOWN = 50;
const REPLIES_SHOWN = 200;
const DEFAULT_CHANNELS = [
  { name: 'general', type: 'TEXT' as const, description: 'Say hello and talk about anything', position: 0 },
  { name: 'announcements', type: 'ANNOUNCEMENT' as const, description: 'News from the people who run this community', position: 1 },
  { name: 'voice', type: 'VOICE' as const, description: 'Meet up and speak together', position: 2 },
];

const person = { select: { id: true, name: true, avatarUrl: true } };

const clean = (value: string | null | undefined) => (value ?? '').trim();

/** A date that must be in the future, or nothing when none was given */
function futureDate(value: string | undefined, what: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new BadRequestException(`${what} must be a date in the future`);
  }
  return date;
}

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    // Reply notifications; optional so the rest works (and tests stay simple) without it
    @Optional() private notifications?: NotificationsService,
  ) {}

  // ============ ACCESS ============

  /** The community and this person's membership. Hidden communities do not exist for anyone. */
  private async visibleCommunity(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { members: { where: { userId }, take: 1 } },
    });
    if (!community || community.hiddenAt) throw new NotFoundException('Community not found');
    return { community, member: community.members[0] ?? null };
  }

  private async requireRole(communityId: string, userId: string, minimum: CommunityMemberRole, message: string) {
    const { community, member } = await this.visibleCommunity(communityId, userId);
    if (!member || rankOf(member.role) < RANK[minimum]) throw new ForbiddenException(message);
    return { community, member };
  }

  private findMember(communityId: string, userId: string) {
    return this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
  }

  private async channelAccess(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { community: { select: { id: true, name: true, hiddenAt: true } } },
    });
    if (!channel || channel.community.hiddenAt) throw new NotFoundException('Channel not found');
    const member = await this.findMember(channel.communityId, userId);
    if (!member) throw new ForbiddenException('You are not a member of this community');
    return { channel, member };
  }

  private async threadAccess(threadId: string, userId: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      select: { id: true, title: true, authorId: true, isLocked: true, channelId: true },
    });
    if (!thread) throw new NotFoundException('Post not found');
    const { channel, member } = await this.channelAccess(thread.channelId, userId);
    return { thread, channel, member };
  }

  // ============ COMMUNITIES ============

  async createCommunity(userId: string, dto: CreateCommunityDto) {
    const name = clean(dto.name);
    if (name.length < 2) throw new BadRequestException('Give your community a name');
    const community = await this.prisma.community.create({
      data: {
        name,
        description: clean(dto.description) || null,
        avatarUrl: dto.avatarUrl,
        bannerUrl: dto.bannerUrl,
        type: dto.type,
        ownerId: userId,
        members: { create: { userId, role: CommunityMemberRole.OWNER } },
        channels: { create: DEFAULT_CHANNELS },
      },
    });
    return this.getCommunityById(community.id, userId);
  }

  /**
   * What this person may see. Members get everything except the ban list, which only admins see. Visitors see a
   * public community's channels and people, the name and description of a restricted one, and nothing of a
   * private one.
   */
  async getCommunityById(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        owner: person,
        members: { include: { user: person } },
        channels: {
          orderBy: { position: 'asc' },
          include: { threads: { orderBy: { createdAt: 'desc' }, take: 5 } },
        },
        roles: { orderBy: { position: 'asc' } },
        bans: { include: { user: person } },
      },
    });

    if (!community) throw new NotFoundException('Community not found');
    if (community.hiddenAt) throw new NotFoundException('This community has been hidden by moderators');

    const me = community.members.find((m) => m.userId === userId);
    const isMember = !!me;
    if (!isMember && community.type === 'PRIVATE') {
      throw new ForbiddenException('This community is invite only');
    }
    const now = new Date();
    const activeBans = community.bans.filter((b) => banIsActive(b, now));
    const viewer = {
      isMember,
      role: me?.role ?? null,
      banned: activeBans.some((b) => b.userId === userId),
    };
    const counts = { members: community.members.length, channels: community.channels.length };

    if (!isMember && community.type === 'RESTRICTED') {
      return { ...community, members: [], channels: [], roles: [], bans: [], _count: counts, viewer };
    }
    return {
      ...community,
      channels: isMember ? community.channels : community.channels.map((c) => ({ ...c, threads: [] })),
      bans: rankOf(me?.role) >= RANK.ADMIN ? activeBans : [],
      _count: counts,
      viewer,
    };
  }

  async getCommunities(userId: string) {
    // Lists only need the counts and this person's own membership, not everybody in every community
    const include = {
      members: { where: { userId }, include: { user: person } },
      _count: { select: { members: true, channels: true } },
    };
    const now = new Date();
    const [owned, joined, recommended] = await Promise.all([
      // Communities hidden by moderators (admin section) are left out of every list
      this.prisma.community.findMany({
        where: { ownerId: userId, hiddenAt: null },
        include,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.community.findMany({
        where: { members: { some: { userId } }, ownerId: { not: userId }, hiddenAt: null },
        include,
        orderBy: { createdAt: 'desc' },
      }),
      // Restricted communities can be found but need an invite; private ones are never listed
      this.prisma.community.findMany({
        where: {
          type: { in: ['PUBLIC', 'RESTRICTED'] },
          hiddenAt: null,
          NOT: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
              { bans: { some: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
            ],
          },
        },
        include,
        take: 10,
        orderBy: [{ members: { _count: 'desc' } }, { createdAt: 'desc' }],
      }),
    ]);
    return { owned, joined, recommended };
  }

  async updateCommunity(userId: string, communityId: string, dto: UpdateCommunityDto) {
    await this.requireRole(communityId, userId, CommunityMemberRole.OWNER, 'Only the owner can update this community');
    const data: UpdateCommunityDto = { ...dto };
    if (dto.name !== undefined) {
      data.name = clean(dto.name);
      if (data.name.length < 2) throw new BadRequestException('Give your community a name');
    }
    if (dto.description !== undefined) data.description = clean(dto.description);
    await this.prisma.community.update({ where: { id: communityId }, data });
    return this.getCommunityById(communityId, userId);
  }

  async deleteCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this community');
    }
    await this.prisma.community.delete({ where: { id: communityId } });
    return { message: 'Community deleted successfully' };
  }

  // ============ CHANNELS ============

  async createChannel(userId: string, communityId: string, dto: CreateChannelDto) {
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can create channels');
    const name = clean(dto.name);
    if (!name) throw new BadRequestException('Give the channel a name');
    const count = await this.prisma.channel.count({ where: { communityId } });
    if (count >= MAX_CHANNELS) throw new BadRequestException(`A community can have up to ${MAX_CHANNELS} channels`);

    if (dto.parentId) {
      const parent = await this.prisma.channel.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.communityId !== communityId || parent.type !== 'CATEGORY') {
        throw new BadRequestException('Invalid parent channel');
      }
    }

    return this.prisma.channel.create({
      data: {
        communityId,
        name,
        description: clean(dto.description) || null,
        type: dto.type,
        parentId: dto.parentId,
        // New channels go last unless a place was asked for
        position: dto.position ?? count,
      },
    });
  }

  async updateChannel(userId: string, communityId: string, channelId: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.communityId !== communityId) throw new NotFoundException('Channel not found');
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can update channels');
    const data: UpdateChannelDto = { ...dto };
    if (dto.name !== undefined) {
      data.name = clean(dto.name);
      if (!data.name) throw new BadRequestException('Give the channel a name');
    }
    if (dto.description !== undefined) data.description = clean(dto.description);
    return this.prisma.channel.update({ where: { id: channelId }, data });
  }

  async deleteChannel(userId: string, communityId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.communityId !== communityId) throw new NotFoundException('Channel not found');
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can delete channels');
    await this.prisma.channel.delete({ where: { id: channelId } });
    return { message: 'Channel deleted successfully' };
  }

  // ============ POSTS (THREADS) AND REPLIES ============

  async createThread(userId: string, channelId: string, dto: CreateThreadDto) {
    const { channel, member } = await this.channelAccess(channelId, userId);
    if (channel.type !== 'TEXT' && channel.type !== 'ANNOUNCEMENT') {
      throw new BadRequestException('Posts can only be made in text channels');
    }
    if (channel.type === 'ANNOUNCEMENT' && rankOf(member.role) < RANK.MODERATOR) {
      throw new ForbiddenException('Only the people who run this community can post announcements');
    }
    const title = clean(dto.title);
    if (!title) throw new BadRequestException('Give your post a title');
    return this.prisma.thread.create({
      data: { channelId, title, content: clean(dto.content) || null, authorId: userId },
      include: { author: person, _count: { select: { messages: true } } },
    });
  }

  async getThreads(channelId: string, userId: string) {
    await this.channelAccess(channelId, userId);
    return this.prisma.thread.findMany({
      where: { channelId },
      include: { author: person, _count: { select: { messages: true } } },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: THREADS_SHOWN,
    });
  }

  /** One post with its latest replies, oldest first */
  async getThreadById(threadId: string, userId: string) {
    const { channel, member } = await this.threadAccess(threadId, userId);
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        author: person,
        messages: { include: { author: person }, orderBy: { createdAt: 'desc' }, take: REPLIES_SHOWN },
        _count: { select: { messages: true } },
      },
    });
    if (!thread) throw new NotFoundException('Post not found');
    return {
      ...thread,
      messages: [...thread.messages].reverse(),
      channel: { id: channel.id, name: channel.name, type: channel.type, communityId: channel.communityId },
      viewer: { role: member.role, canModerate: rankOf(member.role) >= RANK.MODERATOR },
    };
  }

  async replyToThread(userId: string, threadId: string, dto: CreateReplyDto) {
    const content = clean(dto.content);
    if (!content) throw new BadRequestException('Write something first');
    const { thread, channel, member } = await this.threadAccess(threadId, userId);
    if (thread.isLocked && rankOf(member.role) < RANK.MODERATOR) {
      throw new ForbiddenException('This post is locked');
    }
    const [message] = await this.prisma.$transaction([
      this.prisma.threadMessage.create({
        data: { threadId, authorId: userId, content },
        include: { author: person },
      }),
      // A post with a new reply moves back to the top of its channel
      this.prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
    ]);
    if (thread.authorId !== userId) {
      void this.notifications?.notify([thread.authorId], {
        type: 'COMMUNITY_JOIN',
        title: `${message.author.name} replied to your post`,
        message: `${thread.title} · ${channel.community.name}`,
        actionUrl: `/communities/${channel.communityId}?channel=${channel.id}&thread=${thread.id}`,
        data: { actor: message.author },
        // One entry per post, brought back to the top by each new reply
        dedupeKey: `thread-reply:${thread.id}`,
        replace: true,
      });
    }
    return message;
  }

  /** Pin or lock a post */
  async updateThread(userId: string, threadId: string, dto: UpdateThreadDto) {
    const { member } = await this.threadAccess(threadId, userId);
    if (rankOf(member.role) < RANK.MODERATOR) {
      throw new ForbiddenException('Only moderators can pin or lock posts');
    }
    return this.prisma.thread.update({
      where: { id: threadId },
      data: {
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
        ...(dto.isLocked !== undefined ? { isLocked: dto.isLocked } : {}),
      },
    });
  }

  async deleteThread(userId: string, threadId: string) {
    const { thread, member } = await this.threadAccess(threadId, userId);
    if (thread.authorId !== userId && rankOf(member.role) < RANK.MODERATOR) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.prisma.thread.delete({ where: { id: threadId } });
    return { message: 'Post deleted' };
  }

  async deleteReply(userId: string, messageId: string) {
    const reply = await this.prisma.threadMessage.findUnique({
      where: { id: messageId },
      select: { id: true, authorId: true, threadId: true },
    });
    if (!reply) throw new NotFoundException('Reply not found');
    const { member } = await this.threadAccess(reply.threadId, userId);
    if (reply.authorId !== userId && rankOf(member.role) < RANK.MODERATOR) {
      throw new ForbiddenException('You can only delete your own replies');
    }
    await this.prisma.threadMessage.delete({ where: { id: messageId } });
    return { message: 'Reply deleted' };
  }

  /** Sends a post or reply to the SpeakBetter team's report queue, once per person */
  async reportPost(userId: string, kind: 'thread' | 'reply', id: string, dto: ReportPostDto) {
    let authorId: string;
    if (kind === 'thread') {
      ({ thread: { authorId } } = await this.threadAccess(id, userId));
    } else {
      const reply = await this.prisma.threadMessage.findUnique({ where: { id }, select: { authorId: true, threadId: true } });
      if (!reply) throw new NotFoundException('Reply not found');
      await this.threadAccess(reply.threadId, userId);
      authorId = reply.authorId;
    }
    if (authorId === userId) throw new BadRequestException("You can't report your own post");
    const already = await this.prisma.report.findFirst({
      where: { reportedById: userId, targetType: 'THREAD', targetId: id, status: { in: ['PENDING', 'REVIEWING'] } },
      select: { id: true },
    });
    if (!already) {
      await this.prisma.report.create({
        data: { reportedById: userId, targetType: 'THREAD', targetId: id, reason: dto.reason, description: clean(dto.details) || null },
      });
    }
    return { ok: true };
  }

  // ============ MEMBERS ============

  private async activeBan(communityId: string, userId: string) {
    const ban = await this.prisma.communityBan.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    return ban && banIsActive(ban) ? ban : null;
  }

  async joinCommunity(userId: string, communityId: string) {
    const { community, member } = await this.visibleCommunity(communityId, userId);
    if (await this.activeBan(communityId, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }
    if (member) throw new ConflictException('Already a member');
    if (community.type !== 'PUBLIC') {
      throw new ForbiddenException('This community is invite only');
    }
    return this.prisma.communityMember.create({
      data: { communityId, userId, role: CommunityMemberRole.MEMBER },
      include: { user: person },
    });
  }

  async leaveCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId === userId) {
      throw new BadRequestException('Owner cannot leave the community');
    }
    const { count } = await this.prisma.communityMember.deleteMany({ where: { communityId, userId } });
    if (!count) throw new NotFoundException('You are not a member of this community');
    return { message: 'Left community successfully' };
  }

  /** Admins can bring in their friends. Nobody can be put into a community by a stranger. */
  async addMember(userId: string, communityId: string, dto: AddMemberDto) {
    const { member } = await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can add members');
    const friendship = await this.prisma.friend.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: userId, toUserId: dto.userId },
          { fromUserId: dto.userId, toUserId: userId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) throw new ForbiddenException('You can only add your friends. Send anyone else an invite link.');
    if (await this.findMember(communityId, dto.userId)) throw new ConflictException('User is already a member');
    if (await this.activeBan(communityId, dto.userId)) throw new ForbiddenException('This person is banned from this community');

    const role = member.role === CommunityMemberRole.OWNER && isAssignableRole(dto.role) ? dto.role : CommunityMemberRole.MEMBER;
    return this.prisma.communityMember.create({
      data: { communityId, userId: dto.userId, role },
      include: { user: person },
    });
  }

  /** Only the owner hands out roles, and never ownership itself */
  async updateMemberRole(userId: string, communityId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const { community } = await this.requireRole(communityId, userId, CommunityMemberRole.OWNER, 'Only the owner can change roles');
    if (targetUserId === community.ownerId) throw new ForbiddenException("Cannot change the owner's role");
    if (!isAssignableRole(dto.role)) throw new BadRequestException('Choose admin, moderator or member');
    if (!(await this.findMember(communityId, targetUserId))) throw new NotFoundException('Member not found');
    return this.prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { role: dto.role },
      include: { user: person },
    });
  }

  async removeMember(userId: string, communityId: string, targetUserId: string) {
    const { community, member } = await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can remove members');
    if (targetUserId === community.ownerId) throw new ForbiddenException('Cannot remove the owner');
    const target = await this.findMember(communityId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (!canManage(member.role, target.role)) {
      throw new ForbiddenException('You can only remove people below your role');
    }
    await this.prisma.communityMember.delete({
      where: { communityId_userId: { communityId, userId: targetUserId } },
    });
    return { message: 'Member removed successfully' };
  }

  // ============ ROLES ============

  private async ownRole(communityId: string, roleId: string) {
    const role = await this.prisma.communityRole.findFirst({ where: { id: roleId, communityId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(userId: string, communityId: string, dto: CreateRoleDto) {
    await this.requireRole(communityId, userId, CommunityMemberRole.OWNER, 'Only the owner can create roles');
    const existingRole = await this.prisma.communityRole.findFirst({ where: { communityId, name: dto.name } });
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

  async updateRole(userId: string, communityId: string, roleId: string, dto: UpdateRoleDto) {
    await this.requireRole(communityId, userId, CommunityMemberRole.OWNER, 'Only the owner can update roles');
    await this.ownRole(communityId, roleId);
    return this.prisma.communityRole.update({ where: { id: roleId }, data: dto });
  }

  async deleteRole(userId: string, communityId: string, roleId: string) {
    await this.requireRole(communityId, userId, CommunityMemberRole.OWNER, 'Only the owner can delete roles');
    await this.ownRole(communityId, roleId);
    await this.prisma.communityRole.delete({ where: { id: roleId } });
    return { message: 'Role deleted successfully' };
  }

  // ============ BANS ============

  async banMember(userId: string, communityId: string, dto: BanMemberDto) {
    const { community, member } = await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can ban members');
    if (dto.userId === userId) throw new BadRequestException("You can't ban yourself");
    if (dto.userId === community.ownerId) throw new ForbiddenException('Cannot ban the owner');
    const target = await this.findMember(communityId, dto.userId);
    if (target && !canManage(member.role, target.role)) {
      throw new ForbiddenException('You can only ban people below your role');
    }
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    if (await this.activeBan(communityId, dto.userId)) throw new ConflictException('User is already banned');

    const expiresAt = futureDate(dto.expiresAt, 'The end of the ban') ?? null;
    const reason = clean(dto.reason) || null;
    const [, ban] = await this.prisma.$transaction([
      this.prisma.communityMember.deleteMany({ where: { communityId, userId: dto.userId } }),
      // An old ban that ran out is replaced
      this.prisma.communityBan.upsert({
        where: { communityId_userId: { communityId, userId: dto.userId } },
        create: { communityId, userId: dto.userId, createdById: userId, reason, expiresAt },
        update: { createdById: userId, reason, expiresAt },
        include: { user: person },
      }),
    ]);
    return ban;
  }

  async unbanMember(userId: string, communityId: string, targetUserId: string) {
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can unban members');
    await this.prisma.communityBan.deleteMany({ where: { communityId, userId: targetUserId } });
    return { message: 'User unbanned successfully' };
  }

  // ============ INVITES ============

  async getInvites(userId: string, communityId: string) {
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can see invites');
    return this.prisma.communityInvite.findMany({
      where: { communityId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createInvite(userId: string, communityId: string, dto: CreateInviteDto) {
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can create invites');
    return this.prisma.communityInvite.create({
      data: {
        communityId,
        // Long enough that a code to a private community can't be guessed
        code: randomBytes(9).toString('base64url'),
        maxUses: dto.maxUses || 0,
        expiresAt: futureDate(dto.expiresAt, 'The end of the invite'),
        createdBy: userId,
      },
    });
  }

  async revokeInvite(userId: string, communityId: string, inviteId: string) {
    await this.requireRole(communityId, userId, CommunityMemberRole.ADMIN, 'Only owners and admins can cancel invites');
    const { count } = await this.prisma.communityInvite.deleteMany({ where: { id: inviteId, communityId } });
    if (!count) throw new NotFoundException('Invite not found');
    return { message: 'Invite cancelled' };
  }

  async joinByInvite(userId: string, code: string) {
    const invite = await this.prisma.communityInvite.findUnique({
      where: { code },
      include: { community: { select: { id: true, hiddenAt: true } } },
    });
    if (!invite || invite.community.hiddenAt) throw new NotFoundException('Invalid invite code');
    const communityId = invite.community.id;

    // Opening your own invite link again just takes you there
    if (await this.findMember(communityId, userId)) {
      return { ...(await this.getCommunityById(communityId, userId)), alreadyMember: true };
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invite has expired');
    }
    if (await this.activeBan(communityId, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }

    // Counting the use first means two people at once can't both take the last place
    const { count } = await this.prisma.communityInvite.updateMany({
      where: { id: invite.id, ...(invite.maxUses > 0 ? { uses: { lt: invite.maxUses } } : {}) },
      data: { uses: { increment: 1 } },
    });
    if (!count) throw new BadRequestException('Invite has reached maximum uses');

    try {
      await this.prisma.communityMember.create({
        data: { communityId, userId, role: CommunityMemberRole.MEMBER },
      });
    } catch (error) {
      // Joined from another tab at the same moment
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
    return this.getCommunityById(communityId, userId);
  }
}
