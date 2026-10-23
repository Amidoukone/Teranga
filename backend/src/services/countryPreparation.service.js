'use strict';

function validatePreparation(input) {
  const settings = {
    countryCode: String(input.countryCode || '').trim().toUpperCase(),
    operator: String(input.operator || '').trim(),
    contactPhone: String(input.phone || '').replace(/[\s().-]/g, ''),
    currency: String(input.currency || '').trim().toUpperCase(),
    defaultLanguage: String(input.language || '').trim(),
    timezone: String(input.timezone || '').trim(),
  };
  if (!/^[A-Z]{2}$/.test(settings.countryCode)) throw new Error('A two-letter country ISO code is required');
  if (!settings.operator || settings.operator.length > 180) throw new Error('An operator name of 1 to 180 characters is required');
  if (!/^\+[1-9]\d{7,14}$/.test(settings.contactPhone)) throw new Error('A local assistance phone in international format is required');
  if (!/^[A-Z]{3}$/.test(settings.currency)) throw new Error('A three-letter currency code is required');
  if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(settings.defaultLanguage)) throw new Error('A supported language code is required');
  if (!settings.timezone) throw new Error('An explicit IANA time zone is required');
  try { new Intl.DateTimeFormat('en', { timeZone: settings.timezone }).format(); }
  catch (_error) { throw new Error('A valid IANA time zone is required'); }
  return settings;
}

async function prepareCountry(db, input, { apply = false } = {}) {
  const settings = validatePreparation(input);
  async function run(transaction) {
    const query = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
    // Lock the existing country before looking for an operator, including concurrent executions.
    const country = await db.Country.findOne({ where: { isoCode: settings.countryCode }, ...query });
    if (!country) throw new Error(`Existing country not found: ${settings.countryCode}`);
    const masters = await db.Franchise.findAll({ where: { countryId: country.id, type: 'MASTER' }, ...query });
    const organizations = await db.Organization.findAll({ where: { countryId: country.id, type: 'MASTER' }, ...query });
    const territories = await db.Territory.findAll({ where: { countryId: country.id, type: 'COUNTRY' }, attributes: ['id'], ...query });
    const assignments = territories.length ? await db.OrganizationTerritory.findAll({
      where: { territoryId: territories.map((row) => row.id), status: 'active', isPrimary: true }, ...query,
    }) : [];
    const admins = await db.User.findAll({ where: { role: 'admin', countryId: country.id, regionId: null }, attributes: ['id'], ...query });
    const issues = [];
    const master = masters.length === 1 ? masters[0] : null;
    if (masters.length > 1) issues.push({ code: 'OPERATOR_AMBIGUOUS', message: 'Several existing MASTER operators require manual reconciliation.' });
    if (master && (master.status !== 'active' || master.regionId != null || master.legalName.trim().toLowerCase() !== settings.operator.toLowerCase())) {
      issues.push({ code: 'OPERATOR_CONFLICT', message: 'The existing operator differs from the requested active country operator.' });
    }
    if (organizations.some((row) => row.code !== `LEGACY:FRANCHISE:${master?.id}`)) {
      issues.push({ code: 'ORGANIZATION_CONFLICT', message: 'A MASTER organization already exists outside this legacy operator projection.' });
    }
    const projectedOperator = master && organizations.find((row) => row.code === `LEGACY:FRANCHISE:${master.id}`);
    if (assignments.some((row) => !projectedOperator || String(row.organizationId) !== String(projectedOperator.id))) {
      issues.push({ code: 'TERRITORY_OPERATOR_CONFLICT', message: 'A different primary operator is already assigned to the country territory.' });
    }
    if (!admins.length) issues.push({ code: 'LOCAL_ADMIN_MISSING', message: 'An existing country administrator is required; no user will be created.' });
    const values = Object.fromEntries(['currency', 'defaultLanguage', 'timezone', 'contactPhone'].map((field) => [field, settings[field]]));
    const changes = Object.fromEntries(Object.entries(values)
      .filter(([field, value]) => country[field] !== value)
      .map(([field, value]) => [field, { from: country[field] ?? null, to: value }]));
    const output = {
      mode: apply ? 'apply' : 'dry-run',
      scope: settings.countryCode,
      country: { id: country.id, name: country.name, isActive: country.isActive },
      settingsChanges: changes,
      operator: { action: master ? 'reuse' : 'create', id: master?.id || null, name: settings.operator },
      administratorIds: admins.map((row) => row.id),
      readyToApply: issues.length === 0,
      issues,
      applied: false,
    };
    if (!apply || issues.length) return output;
    if (Object.keys(changes).length) await country.update(values, { transaction });
    if (!master) {
      const created = await db.Franchise.create({ type: 'MASTER', countryId: country.id, regionId: null, legalName: settings.operator, status: 'active' }, { transaction });
      output.operator.id = created.id;
    }
    output.applied = true;
    return output;
  }
  return apply ? db.sequelize.transaction(run) : run();
}

module.exports = { validatePreparation, prepareCountry };
