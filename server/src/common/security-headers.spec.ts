import { securityHeaders } from './security-headers';

describe('securityHeaders', () => {
  it('sets the baseline headers, hides X-Powered-By and calls next', () => {
    const headers: Record<string, string> = {};
    const res = {
      removeHeader: jest.fn(),
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };
    const next = jest.fn();

    securityHeaders({} as never, res as never, next);

    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Strict-Transport-Security']).toContain('max-age=');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
