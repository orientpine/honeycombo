const BLOCKED_DOMAINS = ['spam.example', 'clickbaitfarm.com', 'malware.test'];

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isBlockedDomain(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  const hostname = new URL(url).hostname.toLowerCase();

  return BLOCKED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function sanitizeText(str: string, maxLen: number): string {
  return str.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

export function validatePlaylistTitle(title: string): { valid: boolean; error?: string } {
  const normalized = title.trim();

  if (!normalized) {
    return { valid: false, error: 'Title is required' };
  }

  if (normalized.length > 200) {
    return { valid: false, error: 'Title must be 200 characters or fewer' };
  }

  return { valid: true };
}

export function validatePlaylistDescription(desc: string): { valid: boolean; error?: string } {
  const normalized = desc.trim();

  if (normalized.length > 500) {
    return { valid: false, error: 'Description must be 500 characters or fewer' };
  }

  return { valid: true };
}
