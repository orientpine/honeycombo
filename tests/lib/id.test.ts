import { describe, expect, it } from 'vitest';
import { generateId } from '../../functions/lib/id';

describe('generateId', () => {
  it('uses the default length', () => {
    expect(generateId()).toHaveLength(12);
  });

  it('supports custom lengths', () => {
    expect(generateId(21)).toHaveLength(21);
  });

  it('generates different ids', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
