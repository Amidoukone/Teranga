'use strict';

function validateProfile(profile) {
  if (!/^[A-Z]{2}$/.test(profile?.countryCode || '') || !Array.isArray(profile.offers) || !profile.offers.length) throw new Error('An explicit country and a non-empty offer profile are required');
  const codes = new Set();
  for (const offer of profile.offers) {
    if (!/^[A-Z0-9:_-]{1,120}$/.test(offer.code || '') || codes.has(offer.code)) throw new Error('Offer codes must be valid and unique');
    codes.add(offer.code);
    if (!['suspend', 'configure'].includes(offer.action)) throw new Error('Unsupported offer configuration action');
    if (offer.action === 'configure' && (!Number.isSafeInteger(offer.slaMinutes) || offer.slaMinutes < 1 || offer.slaMinutes > 10080 || typeof offer.serviceOutcome !== 'string' || offer.serviceOutcome.trim().length < 10 || offer.serviceOutcome.length > 2000)) throw new Error('Each configured offer needs a valid deadline and outcome');
  }
}

async function configureOperatingOffers(db, profile, { apply = false } = {}) {
  validateProfile(profile);
  async function run(transaction) {
    const query = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
    const country = await db.Country.findOne({ where: { isoCode: profile.countryCode }, ...query });
    if (!country) throw new Error(`Country not found: ${profile.countryCode}`);
    const records = await db.ServiceAvailability.findAll({
      include: [
        { model: db.Territory, as: 'territory', required: true, where: { countryId: country.id, type: 'COUNTRY', regionId: null } },
        { model: db.ServiceDefinition, as: 'definition', required: true, where: { code: profile.offers.map((offer) => offer.code) } },
      ], order: [['id', 'ASC']], ...query,
    });
    const issues = [], plans = [];
    const add = (code, definitionCode, details = {}) => issues.push({ code, definitionCode, ...details });
    for (const desired of profile.offers) {
      const matches = records.filter((row) => row.definition?.code === desired.code);
      if (matches.length !== 1) {
        add(matches.length ? 'NATIONAL_OFFER_AMBIGUOUS' : 'NATIONAL_OFFER_MISSING', desired.code, { availabilityIds: matches.map((row) => row.id) });
        continue;
      }
      const record = matches[0];
      if (String(record.territory?.countryId) !== String(country.id) || record.territory?.type !== 'COUNTRY' || record.territory?.regionId != null) {
        add('OFFER_SCOPE_MISMATCH', desired.code, { availabilityId: record.id });
        continue;
      }
      const patch = {}, changes = {};
      function change(field, before, after) { changes[field] = { from: before ?? null, to: after }; }
      if (desired.action === 'suspend') {
        if (record.isActive) { patch.isActive = false; change('isActive', true, false); }
      } else {
        if (record.slaMinutes == null) {
          patch.slaMinutes = desired.slaMinutes; change('slaMinutes', record.slaMinutes, desired.slaMinutes);
        } else if (Number(record.slaMinutes) !== desired.slaMinutes) {
          add('LOCAL_DEADLINE_CONFLICT', desired.code, { availabilityId: record.id, current: record.slaMinutes, approved: desired.slaMinutes });
        }
        const rules = record.providerRules ?? {};
        if (typeof rules !== 'object' || Array.isArray(rules)) {
          add('LOCAL_RULES_INVALID', desired.code, { availabilityId: record.id });
          continue;
        }
        const outcome = rules.serviceOutcome;
        if (outcome == null || (typeof outcome === 'string' && !outcome.trim())) {
          patch.providerRules = { ...rules, serviceOutcome: desired.serviceOutcome };
          change('serviceOutcome', outcome, desired.serviceOutcome);
        } else if (typeof outcome !== 'string' || outcome.trim() !== desired.serviceOutcome.trim()) {
          add('LOCAL_OUTCOME_CONFLICT', desired.code, { availabilityId: record.id });
        }
        if (rules.coordination?.stageMinutes != null && Number(rules.coordination.stageMinutes) !== desired.slaMinutes) {
          add('LOCAL_STAGE_DEADLINE_CONFLICT', desired.code, { availabilityId: record.id, current: rules.coordination.stageMinutes, approved: desired.slaMinutes });
        }
      }
      plans.push({ record, patch, output: { availabilityId: record.id, code: desired.code, name: record.definition.name, action: desired.action, changes } });
    }
    const changed = plans.filter(({ patch }) => Object.keys(patch).length);
    const result = {
      mode: apply ? 'apply' : 'dry-run', scope: profile.countryCode,
      country: { id: country.id, name: country.name },
      summary: { configuredOffers: profile.offers.filter((offer) => offer.action === 'configure').length, suspendedOffers: profile.offers.filter((offer) => offer.action === 'suspend').length, offersToUpdate: changed.length, blockingIssues: issues.length, readyToApply: issues.length === 0 },
      offers: plans.map(({ output }) => output), issues, applied: false,
    };
    if (apply && !issues.length) {
      for (const { record, patch } of changed) await record.update(patch, { transaction });
      result.applied = true;
    }
    return result;
  }
  return apply ? db.sequelize.transaction(run) : run();
}

module.exports = { validateProfile, configureOperatingOffers };
