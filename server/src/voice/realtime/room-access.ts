import type { Socket } from 'socket.io';

/**
 * True only if this very socket joined the room (voice:join). Anything a
 * client emits "into" a room must pass this: the room name is just a string
 * the client chooses, so without it anyone could write into any room.
 */
/**
 * Every socket of a user joins this room on connect, so an event for "all of
 * someone's tabs and devices" reaches them on any server instance.
 */
export const userRoom = (userId: string) => `user:${userId}`;

export function isSocketInRoom(client: Socket, roomId: unknown) {
  return typeof roomId === 'string' && client.rooms.has(`voice:${roomId}`);
}
