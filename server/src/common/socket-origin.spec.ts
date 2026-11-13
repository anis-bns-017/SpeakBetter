import { isAllowedSocketOrigin, socketCorsOrigin } from './socket-origin';

describe('socket origin rule', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = original;
  });

  it('allows localhost on any port for development', () => {
    delete process.env.FRONTEND_URL;
    expect(isAllowedSocketOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedSocketOrigin('http://127.0.0.1:3000')).toBe(true);
  });

  it('allows the configured frontend, read at call time, with or without a trailing slash', () => {
    delete process.env.FRONTEND_URL;
    expect(isAllowedSocketOrigin('https://app.speakbetter.example')).toBe(
      false,
    );
    process.env.FRONTEND_URL = 'https://app.speakbetter.example/';
    expect(isAllowedSocketOrigin('https://app.speakbetter.example')).toBe(true);
  });

  it('refuses other sites, look-alikes and other schemes', () => {
    process.env.FRONTEND_URL = 'https://app.speakbetter.example';
    expect(isAllowedSocketOrigin('https://evil.example')).toBe(false);
    expect(
      isAllowedSocketOrigin('https://app.speakbetter.example.evil.example'),
    ).toBe(false);
    expect(isAllowedSocketOrigin('http://app.speakbetter.example')).toBe(false);
    expect(isAllowedSocketOrigin('http://localhost.evil.example:5173')).toBe(
      false,
    );
  });

  it('allows the local network outside production only (phone app testing)', () => {
    const env = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      expect(isAllowedSocketOrigin('http://192.168.1.20:15173')).toBe(true);
      expect(isAllowedSocketOrigin('http://10.0.2.2:15173')).toBe(true);
      expect(isAllowedSocketOrigin('http://172.20.0.5:15173')).toBe(true);
      expect(isAllowedSocketOrigin('http://172.40.0.5:15173')).toBe(false);
      expect(isAllowedSocketOrigin('http://192.168.1.20.evil.example:80')).toBe(false);
      process.env.NODE_ENV = 'production';
      expect(isAllowedSocketOrigin('http://192.168.1.20:15173')).toBe(false);
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  it('lets non-browser clients (no Origin header) in, like the REST rule', () => {
    expect(isAllowedSocketOrigin(undefined)).toBe(true);
  });

  it('works as a socket.io origin callback', () => {
    const cb = jest.fn();
    socketCorsOrigin('http://localhost:5173', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
    socketCorsOrigin('https://evil.example', cb);
    expect(cb).toHaveBeenLastCalledWith(null, false);
  });
});
