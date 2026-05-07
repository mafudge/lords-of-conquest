import { describe, it, expect } from 'vitest';
import { parseSeedFromUrl, formatSeedAsUrl } from '../../src/platform/urlSeed.js';

describe('urlSeed', () => {
  it('parses ?seed=12345', () => {
    expect(parseSeedFromUrl('https://example.com/?seed=12345')).toBe(12345);
  });

  it('parses bare ?seed=42 query string', () => {
    expect(parseSeedFromUrl('?seed=42')).toBe(42);
  });

  it('returns null when no seed', () => {
    expect(parseSeedFromUrl('https://example.com/')).toBeNull();
  });

  it('returns null on non-numeric seed', () => {
    expect(parseSeedFromUrl('?seed=abc')).toBeNull();
  });

  it('handles negative seeds', () => {
    expect(parseSeedFromUrl('?seed=-7')).toBe(-7);
  });

  it('formatSeedAsUrl appends/replaces the seed param', () => {
    expect(formatSeedAsUrl('https://example.com/', 99)).toBe('https://example.com/?seed=99');
    expect(formatSeedAsUrl('https://example.com/?seed=1', 99)).toBe('https://example.com/?seed=99');
    expect(formatSeedAsUrl('https://example.com/?foo=bar', 99))
      .toBe('https://example.com/?foo=bar&seed=99');
  });
});
