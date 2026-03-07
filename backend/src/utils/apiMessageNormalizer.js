'use strict';

const TARGET_KEYS = new Set([
  'error',
  'message',
  'title',
  'detail',
  'warning',
  'info',
  'hint',
]);

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

const FRENCH_NORMALIZATION_RULES = [
  [/\bNon authentifie\b/gi, 'Non authentifié'],
  [/\bAcces interdit\b/gi, 'Accès interdit'],
  [/\bActivite\b/gi, 'Activité'],
  [/\bactivites\b/gi, 'activités'],
  [/\bsupprimee\b/gi, 'supprimée'],
  [/\bsupprimees\b/gi, 'supprimées'],
  [/\bactualite\b/gi, 'actualité'],
  [/\bmise a jour\b/gi, 'mise à jour'],
  [/\bdeconnexion\b/gi, 'déconnexion'],
  [/\brecuperation\b/gi, 'récupération'],
  [/\bcaracteres\b/gi, 'caractères'],
  [/\bforcee\b/gi, 'forcée'],
  [/\blie a\b/gi, 'lié à'],
  [/\bSession expiree\b/gi, 'Session expirée'],
  [/\bmarquee\b/gi, 'marquée'],
  [/\bProjet cree avec succes\b/gi, 'Projet créé avec succès'],
  [/\bService cree\b/gi, 'Service créé'],
  [/\bService assigne\b/gi, 'Service assigné'],
  [/\bvous a ete assigne\b/gi, 'vous a été assigné'],
  [/\bStatut service mis a jour\b/gi, 'Statut service mis à jour'],
  [/\bStatut commande mis a jour\b/gi, 'Statut commande mis à jour'],
  [/\bnon lue a marquer\b/gi, 'non lue à marquer'],
  [/\bAucune notification non lue a marquer\b/gi, 'Aucune notification non lue à marquer'],
  [/\bCodes de recuperation\b/gi, 'Codes de récupération'],
  [/\bd abord\b/gi, "d'abord"],
];

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

function countMojibakeMarkers(value) {
  if (typeof value !== 'string' || !value) return 0;
  const globalPattern = new RegExp(MOJIBAKE_PATTERN.source, 'gu');
  return (value.match(globalPattern) || []).length;
}

function fixMojibakeText(value) {
  if (typeof value !== 'string' || !value || !MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  const decoded = decodeWindows1252AsUtf8(value);
  if (!decoded || decoded === value) return value;

  const before = countMojibakeMarkers(value);
  const after = countMojibakeMarkers(decoded);
  return after < before ? decoded : value;
}

function normalizeMessageText(value) {
  if (typeof value !== 'string') return value;

  let next = fixMojibakeText(value).trim();
  if (!next) return next;

  // Nettoie les préfixes décoratifs qui peuvent se transformer en "?" ou "!".
  next = next.replace(
    /^(?:(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3)+\s*)+/gu,
    ''
  );
  next = next.replace(/^[!?]\s+/, '');

  for (const [pattern, replacement] of FRENCH_NORMALIZATION_RULES) {
    next = next.replace(pattern, replacement);
  }

  return next.replace(/\s{2,}/g, ' ').trim();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeApiResponsePayload(value, parentKey = '', seen = new WeakSet()) {
  if (typeof value === 'string') {
    if (TARGET_KEYS.has(parentKey)) return normalizeMessageText(value);
    return fixMojibakeText(value);
  }

  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const normalized = normalizeApiResponsePayload(item, parentKey, seen);
      if (normalized !== item) changed = true;
      return normalized;
    });
    return changed ? next : value;
  }

  if (!isPlainObject(value)) return value;

  let changed = false;
  const next = {};

  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeApiResponsePayload(item, key, seen);
    next[key] = normalized;
    if (normalized !== item) changed = true;
  }

  return changed ? next : value;
}

module.exports = {
  normalizeApiResponsePayload,
  normalizeMessageText,
};
