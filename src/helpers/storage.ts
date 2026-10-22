/**
 * Values are stored JSON stringified in `browser.storage.local`.
 * Keys introduced by an extension update are missing until a page writes their
 * default, so background scripts can read `undefined` for them. A stored value
 * can also be unusable: `null`, left over from an interrupted write, or of a
 * shape the code does not expect. The fallback stands in for all of those,
 * since every reader here assumes the shape of its default.
 */
export const parseStoredValue = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') {
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (e: unknown) {
    console.error('Invalid stored value:', e);
    return fallback;
  }

  // `JSON.parse('null')` returns null without throwing
  if (parsed === null || parsed === undefined) {
    return fallback;
  }

  if (Array.isArray(parsed) !== Array.isArray(fallback) || typeof parsed !== typeof fallback) {
    console.error('Stored value does not match the expected shape:', value.slice(0, 80));
    return fallback;
  }

  return parsed as T;
};
