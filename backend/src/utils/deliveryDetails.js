'use strict';

const { isValidPhone, normalizeOptionalPhone } = require('./contactIdentity');

function resolveDeliveryDetails(
  tradeCategory,
  { recipientName, recipientPhone, packageHandling } = {}
) {
  if (tradeCategory?.slug !== 'livraison') {
    return { recipientName: null, recipientPhone: null, packageHandling: null };
  }

  const normalizedRecipientPhone = normalizeOptionalPhone(recipientPhone);
  if (recipientPhone && !isValidPhone(normalizedRecipientPhone)) {
    const error = new Error('Téléphone du destinataire invalide');
    error.status = 400;
    throw error;
  }

  const handling = Array.isArray(packageHandling)
    ? [...new Set(packageHandling.map((item) => String(item).trim()).filter(Boolean))]
    : [];

  return {
    recipientName: String(recipientName || '').trim() || null,
    recipientPhone: normalizedRecipientPhone,
    packageHandling: handling.length ? handling : null,
  };
}

module.exports = { resolveDeliveryDetails };
