/**
 * Which browser origins may open a socket. Mirrors the REST CORS rule in
 * main.ts: the configured FRONTEND_URL, plus localhost on any port for
 * development (and the local network, outside production). It is a function so FRONTEND_URL is read when a client
 * connects, after the .env file has been loaded (decorators run at import time,
 * too early for that).
 */
const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** Addresses on a home or office network (192.168.x.x, 10.x.x.x, 172.16-31.x.x), any port */
const PRIVATE_NETWORK =
  /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;

/**
 * Outside production only: a phone or the Android emulator (10.0.2.2) trying the site or the SpeakBetter phone
 * app against this computer over the local network.
 */
export const isPrivateNetworkDevOrigin = (origin: string): boolean =>
  process.env.NODE_ENV !== 'production' && PRIVATE_NETWORK.test(origin);

const normalize = (origin: string) => origin.trim().replace(/\/+$/, '');

export function isAllowedSocketOrigin(origin: string | undefined): boolean {
  // Not a browser (no Origin header): same stance as the REST CORS rule
  if (!origin) return true;

  const configured = process.env.FRONTEND_URL;
  if (configured && normalize(origin) === normalize(configured)) return true;

  return LOCAL_DEV.test(origin) || isPrivateNetworkDevOrigin(origin);
}

/** Value for a gateway's `cors.origin` */
export const socketCorsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => callback(null, isAllowedSocketOrigin(origin));
