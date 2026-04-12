import { describe, expect, it } from 'vitest';
import { clearCookie, parseCookies, serializeCookie } from '../../functions/lib/cookies';

describe('parseCookies', () => {
  it('parses an empty header', () => {
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('   ')).toEqual({});
  });

  it('parses a single cookie', () => {
    expect(parseCookies('session=abc123')).toEqual({ session: 'abc123' });
  });

  it('parses multiple cookies and decodes values', () => {
    expect(parseCookies('session=abc123; theme=dark; note=hello%20world')).toEqual({
      session: 'abc123',
      theme: 'dark',
      note: 'hello world',
    });
  });
});

describe('serializeCookie', () => {
  it('serializes a cookie without options', () => {
    expect(serializeCookie('session', 'abc123')).toBe('session=abc123');
  });

  it('serializes a cookie with options', () => {
    expect(
      serializeCookie('session', 'hello world', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 3600,
      }),
    ).toBe('session=hello%20world; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600');
  });
});

describe('clearCookie', () => {
  it('serializes a clearing cookie', () => {
    expect(clearCookie('session')).toBe('session=; Path=/; Max-Age=0');
  });
});
