// frontend/src/utils/mojibake.js

const MOJIBAKE_PATTERN =
  /(?:[\u00C2-\u00C5\u00D0\u00D1]|\u00E2\u20AC|\u00F0\u0178|\u00EF\u00B8|\uFFFD|\u00EF\u00BF\u00BD)/;

// Extra code points present in Windows-1252 but not in ISO-8859-1.
const CP1252_EXTENDED_MAP = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function looksLikeMojibake(value) {
  return typeof value === 'string' && MOJIBAKE_PATTERN.test(value);
}

function toWindows1252Bytes(input) {
  const bytes = [];

  for (const char of input) {
    const cp = char.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
      continue;
    }

    const mapped = CP1252_EXTENDED_MAP[cp];
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }

  return new Uint8Array(bytes);
}

function decodeWindows1252AsUtf8(input) {
  if (typeof TextDecoder === 'undefined') return input;
  const bytes = toWindows1252Bytes(input);
  if (!bytes) return input;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return input;
  }
}

export function fixMojibakeText(value) {
  if (typeof value !== 'string' || !value) return value;
  if (!looksLikeMojibake(value)) return value;

  const decoded = decodeWindows1252AsUtf8(value);
  if (!decoded || decoded === value) return value;

  const before = (value.match(MOJIBAKE_PATTERN) || []).length;
  const after = (decoded.match(MOJIBAKE_PATTERN) || []).length;
  return after < before ? decoded : value;
}

export function fixMojibakeDeep(value, seen = new WeakSet()) {
  if (typeof value === 'string') return fixMojibakeText(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const fixed = fixMojibakeDeep(item, seen);
      if (fixed !== item) changed = true;
      return fixed;
    });
    return changed ? next : value;
  }

  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return value;
  }

  let changed = false;
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    const fixed = fixMojibakeDeep(item, seen);
    next[key] = fixed;
    if (fixed !== item) changed = true;
  }
  return changed ? next : value;
}

export { looksLikeMojibake };
