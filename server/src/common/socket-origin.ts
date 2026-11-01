/**
 * Which browser origins may open a socket. Mirrors the REST CORS rule in
 * main.ts: the configured FRONTEND_URL, plus localhost on any port for
 * development. It is a function so FRONTEND_URL is read when a client
 * connects, after the .env file has been loaded (decorators run at import time,
 * too early for that).
 */
const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

const normalize = (origin: string) => origin.trim().replace(/\/+$/, '');

export function isAllowedSocketOrigin(origin: string | undefined): boolean {
  // Not a browser (no Origin header): same stance as the REST CORS rule
  if (!origin) return true;

  const configured = process.env.FRONTEND_URL;
  if (configured && normalize(origin) === normalize(configured)) return true;

  return LOCAL_DEV.test(origin);
}

/** Value for a gateway's `cors.origin` */
export const socketCorsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => callback(null, isAllowedSocketOrigin(origin));
