import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../../prisma.service';
import { ChatPrivacyService } from '../chat-privacy.service';
import { ChatFeaturesService } from '../chat-features.service';
import { ChatRealtimeState } from './chat-realtime-state';
import { userRoom } from './room-access';

const MEMBERS_CACHE_MS = 30_000;

/**
 * Everything that pushes an event to people in the chat namespace. The gateways,
 * the REST controller and the scheduler all go through here, so none of them
 * needs to depend on a gateway to send something.
 */
@Injectable()
export class ChatBroadcaster {
  private server: Server;
  private readonly logger = new Logger(ChatBroadcaster.name);

  constructor(
    private readonly state: ChatRealtimeState,
    private readonly prisma: PrismaService,
    private readonly privacy: ChatPrivacyService,
    private readonly features: ChatFeaturesService,
  ) {}

  /** Called once by ChatGateway.afterInit with the chat namespace */
  attach(server: Server) {
    this.server = server;
  }

  /** Every tab / device of the user, on any server instance */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  emitToChat(chatId: string, event: string, payload: unknown) {
    this.server.to(`chat:${chatId}`).emit(event, payload);
  }

  /** Everyone with at least one open chat socket, on any server instance */
  async onlineUserIds(): Promise<Set<string>> {
    const sockets = await this.server.fetchSockets();
    return new Set(sockets.map((s) => s.data?.userId as string).filter(Boolean));
  }

  /** How many sockets (tabs / devices) the user has open, on any server instance */
  async socketCount(userId: string): Promise<number> {
    return (await this.server.in(userRoom(userId)).fetchSockets()).length;
  }

  /** Participant ids of a chat (cached briefly — typing events are frequent) */
  async chatMemberIds(chatId: string): Promise<string[]> {
    const hit = this.state.chatMembers.get(chatId);
    if (hit && Date.now() - hit.at < MEMBERS_CACHE_MS) return hit.ids;
    const rows = await this.prisma.chatParticipant.findMany({ where: { chatId }, select: { userId: true } });
    const ids = rows.map((r) => r.userId);
    this.state.chatMembers.set(chatId, { ids, at: Date.now() });
    return ids;
  }

  /**
   * Sends to the other members of a chat who allow `setting` themselves —
   * typing and read receipts are mutual, like WhatsApp.
   */
  async emitToMembersWho(
    chatId: string,
    senderId: string,
    setting: 'showTypingIndicator' | 'sendReadReceipts',
    event: string,
    payload: unknown,
  ) {
    const online = await this.onlineUserIds();
    const others = (await this.chatMemberIds(chatId)).filter((id) => id !== senderId && online.has(id));
    const privacy = await this.privacy.getMany(others);
    for (const id of others) {
      if (privacy.get(id)?.[setting] !== false) this.emitToUser(id, event, payload);
    }
  }

  /** Online/offline is shared only when both people show their online status */
  async broadcastPresence(userId: string, online: boolean, chatIds: string[], communityIds: string[]) {
    if (!(await this.privacy.get(userId)).showOnlineStatus) return;
    const event = online ? 'user:online' : 'user:offline';

    const partners = await this.prisma.chatParticipant.findMany({
      where: { chatId: { in: chatIds }, userId: { not: userId } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const onlineNow = await this.onlineUserIds();
    const onlinePartners = partners.map((p) => p.userId).filter((id) => onlineNow.has(id));
    const privacy = await this.privacy.getMany(onlinePartners);
    for (const id of onlinePartners) {
      if (privacy.get(id)?.showOnlineStatus !== false) this.emitToUser(id, event, { userId });
    }
    for (const communityId of communityIds) {
      this.server.to(`community:${communityId}`).emit(event, { userId });
    }
  }

  /** Who a user may see online: nobody if they hide their own status */
  async visibleOnlineUsers(viewerId: string) {
    if (!(await this.privacy.get(viewerId)).showOnlineStatus) return [];
    const ids = [...(await this.onlineUserIds())].filter((id) => id !== viewerId);
    const privacy = await this.privacy.getMany(ids);
    return ids.filter((id) => privacy.get(id)?.showOnlineStatus !== false);
  }

  /** A message is "delivered" as soon as another member of the chat is connected */
  async deliverIfOnline<T extends { id: string; chatId?: string | null; senderId: string }>(message: T) {
    if (!message.chatId) return message;
    const members = await this.chatMemberIds(message.chatId);
    const online = await this.onlineUserIds();
    if (!members.some((id) => id !== message.senderId && online.has(id))) return message;
    const deliveredAt = await this.features.markDelivered(message.id);
    return { ...message, delivered: true, deliveredAt };
  }

  /** Link preview cards are fetched after sending, then pushed as an update */
  emitLinkPreview(message: { id: string; chatId?: string | null; type?: string; content?: string | null }) {
    if (!message.chatId || message.type !== 'TEXT' || !/https?:\/\//i.test(message.content || '')) return;
    this.features
      .attachLinkPreview(message.id)
      .then((updated) => {
        if (updated) this.emitToChat(message.chatId!, 'message:updated', updated);
      })
      .catch((error) => this.logger.debug(`Link preview failed: ${error?.message || error}`));
  }
}
