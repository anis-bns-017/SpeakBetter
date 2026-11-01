import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RateLimit,
  RateLimitGuard,
  RateLimitOptions,
} from './rate-limit.guard';

const handlerWith = (options?: RateLimitOptions) => {
  class Controller {
    route() {}
  }
  if (options)
    RateLimit(options)(
      Controller.prototype,
      'route',
      Object.getOwnPropertyDescriptor(Controller.prototype, 'route')!,
    );
  return Controller.prototype.route;
};

const ctx = (handler: () => void, ip: string, body: any = {}) => {
  const headers: Record<string, string> = {};
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ ip, body }),
      getResponse: () => ({
        setHeader: (k: string, v: string) => (headers[k] = v),
      }),
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
};

const status = (
  guard: RateLimitGuard,
  handler: () => void,
  ip: string,
  body?: any,
) => {
  const { context, headers } = ctx(handler, ip, body);
  try {
    guard.canActivate(context);
    return { ok: true as const, headers };
  } catch (error) {
    const e = error as HttpException;
    return {
      ok: false as const,
      status: e.getStatus(),
      body: e.getResponse() as any,
      headers,
    };
  }
};

describe('RateLimitGuard', () => {
  let now: number;
  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  const make = () => new RateLimitGuard(new Reflector());

  it('lets routes without the decorator through untouched', () => {
    const guard = make();
    const handler = handlerWith();
    for (let i = 0; i < 500; i++)
      expect(status(guard, handler, '1.1.1.1').ok).toBe(true);
  });

  it('allows `limit` requests, then answers 429 with Retry-After and a code', () => {
    const guard = make();
    const handler = handlerWith({ name: 'x', limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++)
      expect(status(guard, handler, '1.1.1.1').ok).toBe(true);

    const blocked = status(guard, handler, '1.1.1.1');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
      expect(blocked.headers['Retry-After']).toBe('60');
    }
  });

  it('counts each client address separately', () => {
    const guard = make();
    const handler = handlerWith({ name: 'x', limit: 1, windowMs: 60_000 });
    expect(status(guard, handler, '1.1.1.1').ok).toBe(true);
    expect(status(guard, handler, '1.1.1.1').ok).toBe(false);
    expect(status(guard, handler, '2.2.2.2').ok).toBe(true);
  });

  it('keeps routes apart', () => {
    const guard = make();
    const a = handlerWith({ name: 'a', limit: 1, windowMs: 60_000 });
    const b = handlerWith({ name: 'b', limit: 1, windowMs: 60_000 });
    expect(status(guard, a, '1.1.1.1').ok).toBe(true);
    expect(status(guard, b, '1.1.1.1').ok).toBe(true);
    expect(status(guard, a, '1.1.1.1').ok).toBe(false);
  });

  it('the window resets', () => {
    const guard = make();
    const handler = handlerWith({ name: 'x', limit: 1, windowMs: 60_000 });
    status(guard, handler, '1.1.1.1');
    expect(status(guard, handler, '1.1.1.1').ok).toBe(false);
    now += 60_001;
    expect(status(guard, handler, '1.1.1.1').ok).toBe(true);
  });

  it('limits one account across many addresses, ignoring letter case', () => {
    const guard = make();
    const handler = handlerWith({
      name: 'login',
      limit: 100,
      windowMs: 60_000,
      byBodyField: { field: 'email', limit: 3 },
    });
    expect(
      status(guard, handler, '1.1.1.1', { email: 'Ana@example.com' }).ok,
    ).toBe(true);
    expect(
      status(guard, handler, '2.2.2.2', { email: 'ana@example.com' }).ok,
    ).toBe(true);
    expect(
      status(guard, handler, '3.3.3.3', { email: ' ANA@example.com ' }).ok,
    ).toBe(true);
    expect(
      status(guard, handler, '4.4.4.4', { email: 'ana@example.com' }).ok,
    ).toBe(false);
    // a different account from the same fresh address is fine
    expect(
      status(guard, handler, '4.4.4.4', { email: 'ben@example.com' }).ok,
    ).toBe(true);
  });

  it('ignores a missing or non-string body field instead of crashing', () => {
    const guard = make();
    const handler = handlerWith({
      name: 'l',
      limit: 5,
      windowMs: 60_000,
      byBodyField: { field: 'email', limit: 1 },
    });
    expect(status(guard, handler, '1.1.1.1', undefined).ok).toBe(true);
    expect(status(guard, handler, '1.1.1.1', { email: { $ne: null } }).ok).toBe(
      true,
    );
    expect(status(guard, handler, '1.1.1.1', { email: 42 }).ok).toBe(true);
  });
});
