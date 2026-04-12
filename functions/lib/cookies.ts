export interface CookieSerializeOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
}

export function parseCookies(header: string): Record<string, string> {
  if (!header.trim()) {
    return {};
  }

  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export function serializeCookie(name: string, value: string, opts: CookieSerializeOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (opts.httpOnly) {
    parts.push('HttpOnly');
  }

  if (opts.secure) {
    parts.push('Secure');
  }

  if (opts.sameSite) {
    parts.push(`SameSite=${opts.sameSite}`);
  }

  if (opts.path) {
    parts.push(`Path=${opts.path}`);
  }

  if (typeof opts.maxAge === 'number') {
    parts.push(`Max-Age=${opts.maxAge}`);
  }

  return parts.join('; ');
}

export function clearCookie(name: string): string {
  return serializeCookie(name, '', { path: '/', maxAge: 0 });
}
