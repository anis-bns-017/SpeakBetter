// server/src/admin/admin-reports.service.ts
// One moderation queue for every kind of report:
//   - "app" reports (Report table): a person or a message, from chat, voice rooms and community posts
//   - "random-call" reports (RandomCallReport table): a person met in a random call
// Each item shows what was reported (the message text, the person) so a moderator can decide without digging.
// Resolving can also warn or suspend the person and delete the message, in one step.

import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminUsersService } from './admin-users.service';
import { AdminContentService } from './admin-content.service';
import { RandomCallService } from '../random-call/random-call.service';
import type { Actor } from './admin.roles';

export type ReportSource = 'app' | 'random-call';
export type ReportState = 'open' | 'closed' | 'all';

const APP_OPEN = ['PENDING', 'REVIEWING'] as const;
const CALL_OPEN = ['PENDING'];
const FETCH = 300;
const PAGE = 25;

interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface QueueItem {
  key: string;
  source: ReportSource;
  id: string;
  reason: string;
  details: string | null;
  status: string;
  open: boolean;
  createdAt: Date;
  reporter: PersonRef | null;
  /** The person the report is about (the sender, for a message) */
  subject: PersonRef | null;
  /** user | message | room-message | community | other */
  targetType: string;
  targetId: string;
  /** The reported message, when there is one */
  content: string | null;
  contentDeleted: boolean;
  where: string | null;
  resolution: string | null;
}

const personSelect = { id: true, name: true, avatarUrl: true } as const;

/** What can be removed from a report */
type MessageKind = 'message' | 'room-message' | 'thread' | 'thread-reply';
const isMessageKind = (type: string): type is MessageKind => ['message', 'room-message', 'thread', 'thread-reply'].includes(type);

@Injectable()
export class AdminReportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
    private users: AdminUsersService,
    private content: AdminContentService,
    // Upholding a random-call report pauses the person's calls
    @Optional() private calls?: RandomCallService,
  ) {}

  async counts() {
    const [app, call] = await Promise.all([
      this.prisma.report.count({ where: { status: { in: [...APP_OPEN] } } }),
      this.prisma.randomCallReport.count({ where: { status: { in: CALL_OPEN } } }),
    ]);
    return { open: app + call, app, randomCall: call };
  }

  async list(query: { state?: string; source?: string; page?: number }) {
    const state = (['open', 'closed', 'all'].includes(String(query.state)) ? query.state : 'open') as ReportState;
    const source = query.source === 'app' || query.source === 'random-call' ? query.source : 'all';
    const page = Math.max(1, Math.floor(Number(query.page) || 1));

    const appStatus = state === 'open' ? { in: [...APP_OPEN] } : state === 'closed' ? { notIn: [...APP_OPEN] } : undefined;
    const callStatus = state === 'open' ? { in: CALL_OPEN } : state === 'closed' ? { notIn: CALL_OPEN } : undefined;

    const [appRows, callRows] = await Promise.all([
      source === 'random-call'
        ? []
        : this.prisma.report.findMany({
            where: appStatus ? { status: appStatus } : {},
            orderBy: { createdAt: state === 'open' ? 'asc' : 'desc' },
            take: FETCH,
            include: { reportedBy: { select: personSelect } },
          }),
      source === 'app'
        ? []
        : this.prisma.randomCallReport.findMany({
            where: callStatus ? { status: callStatus } : {},
            orderBy: { createdAt: state === 'open' ? 'asc' : 'desc' },
            take: FETCH,
            include: { reporter: { select: personSelect }, reported: { select: personSelect } },
          }),
    ]);

    // Oldest first while open (a queue), newest first once handled (a history)
    const merged = [
      ...appRows.map((r) => ({ kind: 'app' as const, row: r, at: r.createdAt.getTime() })),
      ...callRows.map((r) => ({ kind: 'random-call' as const, row: r, at: r.createdAt.getTime() })),
    ].sort((a, b) => (state === 'open' ? a.at - b.at : b.at - a.at));
    const total = merged.length;
    const slice = merged.slice((page - 1) * PAGE, page * PAGE);

    const appSlice = slice.filter((s) => s.kind === 'app').map((s) => s.row as (typeof appRows)[number]);
    const targets = await this.loadTargets(appSlice);

    const items: QueueItem[] = slice.map((s) => {
      if (s.kind === 'random-call') {
        const r = s.row as (typeof callRows)[number];
        return {
          key: `random-call:${r.id}`,
          source: 'random-call',
          id: r.id,
          reason: r.reason,
          details: r.details,
          status: r.status,
          open: CALL_OPEN.includes(r.status),
          createdAt: r.createdAt,
          reporter: r.reporter,
          subject: r.reported,
          targetType: 'user',
          targetId: r.reportedId,
          content: null,
          contentDeleted: false,
          where: 'Random call',
          resolution: null,
        };
      }
      const r = s.row as (typeof appRows)[number];
      const t = targets.get(r.id);
      return {
        key: `app:${r.id}`,
        source: 'app',
        id: r.id,
        reason: r.reason,
        details: r.description,
        status: r.status,
        open: (APP_OPEN as readonly string[]).includes(r.status),
        createdAt: r.createdAt,
        reporter: r.reportedBy,
        subject: t?.subject ?? null,
        targetType: t?.type ?? r.targetType.toLowerCase(),
        targetId: r.targetId,
        content: t?.content ?? null,
        contentDeleted: t?.deleted ?? false,
        where: t?.where ?? null,
        resolution: r.resolution,
      };
    });

    return { state, source, page, pages: Math.max(1, Math.ceil(total / PAGE)), total, items, counts: await this.counts() };
  }

  /**
   * Closes a report. `decision`: "dismiss" (nothing wrong) or "action" (the report was right). With "action",
   * the person can also be warned or suspended and the reported message deleted, in the same step.
   */
  async resolve(
    actor: Actor,
    source: string,
    id: string,
    input: { decision?: unknown; note?: unknown; warn?: unknown; suspendDays?: unknown; permanent?: unknown; deleteContent?: unknown },
  ) {
    if (input.decision !== 'dismiss' && input.decision !== 'action') throw new BadRequestException('Choose dismiss or take action');
    const dismiss = input.decision === 'dismiss';
    const note = typeof input.note === 'string' ? input.note.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    const wantsSuspension = input.permanent === true || Number(input.suspendDays) > 0;
    const wantsWarning = typeof input.warn === 'string' && input.warn.trim().length > 0;

    let subjectId: string | null = null;
    let label: string;
    let message: { id: string; kind: MessageKind } | null = null;
    let callReason: string | null = null;
    let close: () => Promise<{ count: number }>;
    let reopen: () => Promise<unknown>;

    if (source === 'random-call') {
      const report = await this.prisma.randomCallReport.findUnique({ where: { id }, include: { reported: { select: { name: true } } } });
      if (!report) throw new NotFoundException('Report not found');
      if (!CALL_OPEN.includes(report.status)) throw new ConflictException('This report has already been handled');
      const before = report.status;
      subjectId = report.reportedId;
      callReason = report.reason;
      label = `a random-call report about ${report.reported.name} (${report.reason})`;
      close = () =>
        this.prisma.randomCallReport.updateMany({
          where: { id, status: { in: CALL_OPEN } },
          data: { status: dismiss ? 'DISMISSED' : 'UPHELD', reviewedById: actor.id },
        });
      reopen = () => this.prisma.randomCallReport.update({ where: { id }, data: { status: before, reviewedById: null } });
    } else if (source === 'app') {
      const report = await this.prisma.report.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Report not found');
      if (!(APP_OPEN as readonly string[]).includes(report.status)) throw new ConflictException('This report has already been handled');
      const before = report.status;
      const target = (await this.loadTargets([report])).get(report.id);
      subjectId = target?.subject?.id ?? null;
      // Something already removed can't be removed again
      if (target && !target.deleted && isMessageKind(target.type)) message = { id: report.targetId, kind: target.type };
      label = `a report about ${target?.subject?.name ?? 'a ' + report.targetType.toLowerCase()} (${report.reason})`;
      close = () =>
        this.prisma.report.updateMany({
          where: { id, status: { in: [...APP_OPEN] } },
          data: { status: dismiss ? 'REJECTED' : 'RESOLVED', reviewedById: actor.id, resolution: note || (dismiss ? 'Dismissed' : 'Action taken') },
        });
      reopen = () => this.prisma.report.update({ where: { id }, data: { status: before, reviewedById: null, resolution: null } });
    } else {
      throw new BadRequestException('Unknown report source');
    }

    // Everything this decision would do is checked first: a refused one must leave nothing half done
    if (!dismiss && subjectId && (wantsSuspension || wantsWarning || callReason)) {
      await this.users.assertCanModerate(actor, subjectId, { days: input.suspendDays, permanent: input.permanent });
    }

    // Two people on the same report: only the first decision counts
    const { count } = await close();
    if (!count) throw new ConflictException('This report has already been handled');

    const done: string[] = [];
    if (!dismiss) {
      try {
        if (input.deleteContent === true && message) {
          await this.content.deleteMessage(actor, message.kind, message.id, note || 'Reported and removed');
          done.push('deleted the message');
        }
        if (callReason && subjectId && (await this.calls?.applyRestriction(subjectId, `Report upheld by a moderator (${callReason})`))) {
          done.push('paused their random calls');
        }
        if (subjectId && wantsSuspension) {
          await this.users.suspend(actor, subjectId, {
            days: input.suspendDays,
            permanent: input.permanent === true,
            reason: note || 'Broke the community rules (from a report)',
          });
          const n = Math.floor(Number(input.suspendDays));
          done.push(input.permanent === true ? 'closed the account' : `suspended for ${n} day${n === 1 ? '' : 's'}`);
        } else if (subjectId && wantsWarning) {
          await this.users.warn(actor, subjectId, input.warn);
          done.push('sent a warning');
        }
      } catch (error) {
        // Nothing happened yet, so the report goes back in the queue
        if (!done.length) await reopen();
        throw error;
      }
    }

    await this.audit.record(actor, {
      action: dismiss ? 'report.dismiss' : 'report.resolve',
      targetType: 'report',
      targetId: id,
      summary: `${dismiss ? 'Dismissed' : 'Resolved'} ${label}${done.length ? `; ${done.join(', ')}` : ''}${note ? `. Note: ${note}` : ''}`,
      details: { source, subjectId },
    });
    return { ok: true, counts: await this.counts() };
  }

  /** What each app report points at: the person, or the message (chat or voice room) and who sent it */
  private async loadTargets(reports: Array<{ id: string; targetId: string; targetType: string; description: string | null }>) {
    const out = new Map<string, { type: string; subject: PersonRef | null; content: string | null; deleted: boolean; where: string | null }>();
    const userIds = reports.filter((r) => r.targetType === 'USER').map((r) => r.targetId);
    const messageIds = reports.filter((r) => r.targetType === 'MESSAGE').map((r) => r.targetId);
    const communityIds = reports.filter((r) => r.targetType === 'COMMUNITY').map((r) => r.targetId);
    // A community post or a reply to one
    const postIds = reports.filter((r) => r.targetType === 'THREAD').map((r) => r.targetId);
    const postPlace = { channel: { select: { name: true, community: { select: { name: true } } } } } as const;

    const [users, messages, roomMessages, communities, posts, replies] = await Promise.all([
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: personSelect }) : [],
      messageIds.length
        ? this.prisma.message.findMany({
            where: { id: { in: messageIds } },
            select: { id: true, content: true, isDeleted: true, chatId: true, communityId: true, sender: { select: personSelect } },
          })
        : [],
      messageIds.length
        ? this.prisma.voiceRoomMessage.findMany({
            where: { id: { in: messageIds } },
            select: { id: true, content: true, room: { select: { name: true } }, sender: { select: personSelect } },
          })
        : [],
      communityIds.length
        ? this.prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true, name: true, owner: { select: personSelect } } })
        : [],
      postIds.length
        ? this.prisma.thread.findMany({
            where: { id: { in: postIds } },
            select: { id: true, title: true, content: true, author: { select: personSelect }, ...postPlace },
          })
        : [],
      postIds.length
        ? this.prisma.threadMessage.findMany({
            where: { id: { in: postIds } },
            select: { id: true, content: true, author: { select: personSelect }, thread: { select: postPlace } },
          })
        : [],
    ]);
    const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    const u = byId(users);
    const m = byId(messages);
    const rm = byId(roomMessages);
    const c = byId(communities);
    const p = byId(posts);
    const pr = byId(replies);
    const placeOf = (channel: { name: string; community: { name: string } }) => `Community “${channel.community.name}” · #${channel.name}`;

    for (const r of reports) {
      if (r.targetType === 'USER') {
        out.set(r.id, { type: 'user', subject: u.get(r.targetId) ?? null, content: null, deleted: false, where: null });
      } else if (r.targetType === 'MESSAGE') {
        const chat = m.get(r.targetId);
        const room = rm.get(r.targetId);
        if (chat) {
          out.set(r.id, {
            type: 'message',
            subject: chat.sender,
            content: chat.content,
            deleted: chat.isDeleted,
            where: chat.communityId ? 'Community chat' : 'Chat',
          });
        } else if (room) {
          out.set(r.id, { type: 'room-message', subject: room.sender, content: room.content, deleted: false, where: `Voice room “${room.room.name}”` });
        } else {
          out.set(r.id, { type: 'message', subject: null, content: null, deleted: true, where: null });
        }
      } else if (r.targetType === 'COMMUNITY') {
        const community = c.get(r.targetId);
        out.set(r.id, { type: 'community', subject: community?.owner ?? null, content: community ? `Community “${community.name}”` : null, deleted: !community, where: 'Communities' });
      } else if (r.targetType === 'THREAD') {
        const post = p.get(r.targetId);
        const reply = pr.get(r.targetId);
        if (post) {
          out.set(r.id, { type: 'thread', subject: post.author, content: post.content ? `${post.title}: ${post.content}` : post.title, deleted: false, where: placeOf(post.channel) });
        } else if (reply) {
          out.set(r.id, { type: 'thread-reply', subject: reply.author, content: reply.content, deleted: false, where: placeOf(reply.thread.channel) });
        } else {
          out.set(r.id, { type: 'thread', subject: null, content: null, deleted: true, where: 'Communities' });
        }
      } else {
        out.set(r.id, { type: 'other', subject: null, content: null, deleted: false, where: null });
      }
    }
    return out;
  }
}
