import { Injectable } from '@nestjs/common';

/**
 * Who is typing and the cached chat member lists, shared by every chat gateway.
 * In memory, per server instance: who is *online* is read from socket.io
 * itself (see ChatBroadcaster), which spans instances when Redis is on.
 */
@Injectable()
export class ChatRealtimeState {
  /** room ("chat:<id>" / "community:<id>") -> users currently typing */
  readonly typingUsers = new Map<string, Set<string>>();
  /** chatId -> participant ids, cached briefly (typing events are frequent) */
  readonly chatMembers = new Map<string, { ids: string[]; at: number }>();
}
