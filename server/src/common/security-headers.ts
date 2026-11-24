// server/src/common/security-headers.ts
// Baseline response headers for the API. Small and dependency-free: the API only returns JSON and public uploads, so
// the useful protections are stopping content-type guessing, clickjacking and referrer leaks.
import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=()');
  // Only meaningful over https, and browsers ignore it over plain http
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}
