import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async follow(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException("You can't follow yourself");
    const [target, me, blocked] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } }),
      this.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: targetId },
            { blockerId: targetId, blockedId: userId },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (!target) throw new NotFoundException('User not found');
    if (blocked) throw new BadRequestException("You can't follow this person");

    try {
      await this.prisma.follow.create({ data: { followerId: userId, followingId: targetId } });
    } catch (error) {
      // Already following: nothing more to do
      if ((error as { code?: string })?.code === 'P2002') return this.status(userId, targetId);
      throw error;
    }
    await this.syncCounts([userId, targetId]);

    void this.notifications.notify([targetId], {
      type: 'NEW_FOLLOWER',
      title: `${me?.name ?? 'Someone'} followed you`,
      message: "You'll show up in their feed when you go live or schedule a room.",
      actionUrl: '/friends',
      data: { actor: me },
      // Following again after unfollowing does not notify twice
      dedupeKey: `follow:${userId}`,
      preference: 'newFollowers',
    });
    return this.status(userId, targetId);
  }

  async unfollow(userId: string, targetId: string) {
    const { count } = await this.prisma.follow.deleteMany({ where: { followerId: userId, followingId: targetId } });
    if (count) await this.syncCounts([userId, targetId]);
    return this.status(userId, targetId);
  }

  async status(userId: string, targetId: string) {
    const [following, followedBy, followers, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followerId: userId, followingId: targetId } }),
      this.prisma.follow.count({ where: { followerId: targetId, followingId: userId } }),
      this.prisma.follow.count({ where: { followingId: targetId } }),
      this.prisma.follow.count({ where: { followerId: targetId } }),
    ]);
    return { following: following > 0, followedBy: followedBy > 0, followers, followingCount };
  }

  /** Who follows `userId` (for "X is live" notifications) */
  async followerIds(userId: string, limit = 500): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true }, take: limit });
    return rows.map((r) => r.followerId);
  }

  /** Keeps the counts on profiles in step with the follow table */
  private async syncCounts(userIds: string[]) {
    await Promise.all(
      userIds.map(async (id) => {
        const [followers, following] = await Promise.all([
          this.prisma.follow.count({ where: { followingId: id } }),
          this.prisma.follow.count({ where: { followerId: id } }),
        ]);
        await this.prisma.profile.updateMany({ where: { userId: id }, data: { followersCount: followers, followingCount: following } });
      }),
    );
  }
}
