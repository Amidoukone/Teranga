'use strict';

// Les libellés traduits ne constituent pas la liste des devises autorisées.
// Une devise configurée pour un pays doit traverser tous les flux métier.
function normalizeCurrency(input, fallback = 'XOF') {
  const currency = typeof input === 'string' ? input.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

module.exports = { normalizeCurrency };
