'use strict';

const {
  normalizeApiResponsePayload,
  normalizeMessageText,
} = require('../../src/utils/apiMessageNormalizer');

describe('apiMessageNormalizer', () => {
  test('normalizes common French message forms', () => {
    expect(normalizeMessageText('Acces interdit')).toBe('Accès interdit');
    expect(normalizeMessageText('Non authentifie')).toBe('Non authentifié');
  });

  test('fixes mojibake in message keys', () => {
    const payload = {
      error: 'Session expir\u00C3\u00A9e',
      message: 'Codes de r\u00C3\u00A9cup\u00C3\u00A9ration',
    };

    const normalized = normalizeApiResponsePayload(payload);

    expect(normalized.error).toBe('Session expirée');
    expect(normalized.message).toBe('Codes de récupération');
  });

  test('fixes mojibake in non-message data fields', () => {
    const payload = {
      service: {
        title: 'R\u00C3\u00A9paration',
        description: 'R\u00C3\u00A9paration de c\u00C5\u201Cur',
      },
      list: ['Cr\u00C3\u00A9ation', 'Mise \u00C3\u00A0 jour'],
    };

    const normalized = normalizeApiResponsePayload(payload);

    expect(normalized.service.title).toBe('Réparation');
    expect(normalized.service.description).toBe('Réparation de cœur');
    expect(normalized.list).toEqual(['Création', 'Mise à jour']);
  });

  test('keeps clean payloads unchanged', () => {
    const payload = {
      message: 'Operation reussie',
      service: { title: 'Réparation' },
      total: 12,
    };

    const normalized = normalizeApiResponsePayload(payload);

    expect(normalized).toEqual(payload);
  });
});
