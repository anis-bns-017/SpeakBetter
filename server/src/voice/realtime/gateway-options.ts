import { socketCorsOrigin } from '../../common/socket-origin';

/**
 * Every voice gateway shares one socket.io namespace ("voice"): Nest hands
 * each of them the same server, and a client connects once and can use all
 * of their events. Authentication happens once, in VoiceGateway's middleware.
 */
export const VOICE_GATEWAY_OPTIONS = {
  cors: {
    origin: socketCorsOrigin,
    credentials: true,
  },
  namespace: 'voice',
};
