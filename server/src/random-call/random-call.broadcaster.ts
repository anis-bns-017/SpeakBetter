import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/** Every socket of a user joins this room, so one emit reaches all their tabs on any instance */
export const callUserRoom = (userId: string) => `user:${userId}`;

/** Pushes events to people in the random-call namespace */
@Injectable()
export class RandomCallBroadcaster {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(callUserRoom(userId)).emit(event, payload);
  }

  /** Sockets (tabs / devices) the user has open in this namespace, on any instance */
  async socketCount(userId: string): Promise<number> {
    if (!this.server) return 0;
    return (await this.server.in(callUserRoom(userId)).fetchSockets()).length;
  }

  /** Closes every socket the user has here (used when they are restricted) */
  disconnectUser(userId: string) {
    this.server?.in(callUserRoom(userId)).disconnectSockets(true);
  }
}
