import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { AuthService } from '../auth/auth.service';
import { socketCorsOrigin } from '../common/socket-origin';
import { NotificationsService } from './notifications.service';

const userRoom = (userId: string) => `user:${userId}`;

/** The token from the cookie, the auth object, the query or an Authorization header (the same places as chat) */
function tokenOf(client: Socket): string | null {
  const cookieHeader = client.handshake.headers.cookie;
  if (cookieHeader) {
    const token = (parseCookie(String(cookieHeader)) as Record<string, string>)['accessToken'];
    if (token) return token;
  }
  const fromAuth = client.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
  const fromQuery = client.handshake.query?.token;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  const header = client.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * A small socket every signed-in page keeps open, so notifications arrive while you are anywhere in the app.
 * It only sends: the bell talks to the REST endpoints for everything else.
 */
@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: socketCorsOrigin, credentials: true, methods: ['GET', 'POST', 'OPTIONS'] },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private auth: AuthService,
    private notifications: NotificationsService,
  ) {}

  afterInit(server: Server) {
    this.notifications.attachEmitter((userId, event, payload) => server.to(userRoom(userId)).emit(event, payload));
    server.use((socket, next) => {
      const token = tokenOf(socket);
      if (!token) return next(new Error('Unauthorized'));
      // Signature, expiry, live session and existing user: the same rules as HTTP
      this.auth.authenticateAccessToken(token).then(
        (authed) => {
          if (!authed) return next(new Error('Unauthorized'));
          socket.data.userId = authed.user.id;
          next();
        },
        (error) => {
          this.logger.warn(`Notification socket auth failed: ${(error as Error)?.message}`);
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  async handleConnection(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return client.disconnect(true);
    await client.join(userRoom(userId));
    // The bell can show the right count straight away
    client.emit('notification:unread', { unread: await this.notifications.unreadCount(userId) });
  }
}
