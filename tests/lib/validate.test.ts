import { describe, expect, it } from 'vitest';
import {
  isBlockedDomain,
  isValidUrl,
  sanitizeText,
  validatePlaylistDescription,
  validatePlaylistTitle,
} from '../../functions/lib/validate';

describe('isValidUrl', () => {
  it('accepts valid http and https urls', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects invalid or unsupported urls', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });
});

describe('isBlockedDomain', () => {
  it('matches exact blocked domains', () => {
    expect(isBlockedDomain('https://clickbaitfarm.com/post')).toBe(true);
  });

  it('matches blocked subdomains', () => {
    expect(isBlockedDomain('https://news.spam.example/story')).toBe(true);
  });

  it('ignores normal or invalid domains', () => {
    expect(isBlockedDomain('https://example.com')).toBe(false);
    expect(isBlockedDomain('not-a-url')).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeText('  hello\n\t  world  ', 50)).toBe('hello world');
  });

  it('truncates to the maximum length', () => {
    expect(sanitizeText('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghij');
  });
});

describe('validatePlaylistTitle', () => {
  it('accepts valid titles', () => {
    expect(validatePlaylistTitle(' My playlist ')).toEqual({ valid: true });
    expect(validatePlaylistTitle('a'.repeat(200))).toEqual({ valid: true });
  });

  it('rejects empty or too-long titles', () => {
    expect(validatePlaylistTitle('   ')).toEqual({ valid: false, error: 'Title is required' });
    expect(validatePlaylistTitle('a'.repeat(201))).toEqual({
      valid: false,
      error: 'Title must be 200 characters or fewer',
    });
  });
});

describe('validatePlaylistDescription', () => {
  it('accepts empty and max-length descriptions', () => {
    expect(validatePlaylistDescription('')).toEqual({ valid: true });
    expect(validatePlaylistDescription(' '.repeat(10))).toEqual({ valid: true });
    expect(validatePlaylistDescription('a'.repeat(500))).toEqual({ valid: true });
  });

  it('rejects descriptions over 500 characters', () => {
    expect(validatePlaylistDescription('a'.repeat(501))).toEqual({
      valid: false,
      error: 'Description must be 500 characters or fewer',
    });
  });
});
