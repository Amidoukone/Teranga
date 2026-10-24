'use strict';
const { Transaction } = require('../../models');

// Appelé seulement après vérification des droits sur le service. Les écritures en attente
// et les dépenses de fonctionnement ne constituent pas un règlement du client.
async function getServicePaymentState(service) {
  const rows = await Transaction.findAll({ where: { serviceId: service.id, type: 'revenue', status: 'completed' }, attributes: ['amount', 'currency', 'proofFile'] });
  const currency = String(service.currency || '').toUpperCase();
  let recordedPayments = 0;
  for (const row of rows) {
    const amount = Number(row.amount);
    if (row.proofFile && String(row.currency || '').toUpperCase() === currency && Number.isFinite(amount)) recordedPayments += amount;
  }
  return { currency, recordedPayments, agreedAmount: null, remainingAmount: null };
}
module.exports = { getServicePaymentState };
