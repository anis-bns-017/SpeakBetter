import { socketCorsOrigin } from '../../common/socket-origin';

/**
 * Every chat gateway shares one socket.io namespace ("chat"): Nest hands each
 * of them the same server, and a client connects once and can use all of their
 * events. Authentication happens once, in ChatGateway's middleware.
 */
export const CHAT_GATEWAY_OPTIONS = {
  cors: {
    origin: socketCorsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
    ],
  },
  namespace: 'chat',
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
};
