import { describe, expect, it, vi } from 'vitest';

import { parseStoredValue } from '@/helpers/storage';

describe('parseStoredValue', () => {
  it('parses a stored value', () => {
    expect(parseStoredValue('{"a":1}', {})).toEqual({ a: 1 });
    expect(parseStoredValue('["a"]', [] as string[])).toEqual(['a']);
    expect(parseStoredValue('true', false)).toBe(true);
  });

  it('falls back when the key is missing', () => {
    expect(parseStoredValue(undefined, [])).toEqual([]);
    expect(parseStoredValue(null, { socksEnabled: false })).toEqual({ socksEnabled: false });
  });

  it('falls back on a stored null, which JSON.parse accepts', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseStoredValue('null', ['keep'])).toEqual(['keep']);
  });

  it('falls back on invalid JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseStoredValue('not json at all', {})).toEqual({});
    expect(parseStoredValue('{"broken": ', { ok: true })).toEqual({ ok: true });
  });

  it('falls back when the shape is not the one expected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // An array where a map is expected, and the other way round
    expect(parseStoredValue('[]', {})).toEqual({});
    expect(parseStoredValue('{}', [] as string[])).toEqual([]);
    expect(parseStoredValue('"text"', false)).toBe(false);
    expect(parseStoredValue('3', false)).toBe(false);
  });
});
