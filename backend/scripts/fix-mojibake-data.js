'use strict';

const { TextDecoder } = require('util');

const argv = process.argv.slice(2);

function hasFlag(flag) {
  return argv.includes(flag);
}

function collectArgValues(flag) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === flag) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        values.push(next);
        i += 1;
      }
      continue;
    }
    if (current.startsWith(`${flag}=`)) {
      values.push(current.slice(flag.length + 1));
    }
  }
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function readIntArg(flag, defaultValue) {
  const [raw] = collectArgValues(flag);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function printHelp() {
  console.log(`
fix-mojibake-data

Purpose:
  Scan historical DB content and repair common UTF-8/Windows-1252 mojibake.

Safe defaults:
  - dry-run by default (no write)
  - only curated business text fields are scanned

Usage:
  node scripts/fix-mojibake-data.js --dry-run
  node scripts/fix-mojibake-data.js --apply
  node scripts/fix-mojibake-data.js --apply --model=Task,Service
  node scripts/fix-mojibake-data.js --apply --all-text-fields --no-json
  node scripts/fix-mojibake-data.js --dry-run --silent

Options:
  --dry-run            Scan only (default if --apply is not set)
  --apply              Persist fixes in DB
  --model=<names>      Comma-separated model names to process
  --models=<names>     Alias of --model
  --batch-size=<n>     Batch size per query (default: 200)
  --samples=<n>        Max change samples per model in logs (default: 5)
  --all-text-fields    Process all STRING/TEXT/CHAR fields (advanced)
  --no-json            Skip JSON fields
  --silent             Hide SQL "Executing ..." logs
  --verbose            Print per-record update logs
  --help               Show this help
`);
}

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp();
  process.exit(0);
}

const db = require('../models');
const { Op } = db.Sequelize;

const APPLY = hasFlag('--apply');
const DRY_RUN = hasFlag('--dry-run') || !APPLY;
const BATCH_SIZE = readIntArg('--batch-size', 200);
const SAMPLE_LIMIT = readIntArg('--samples', 5);
const INCLUDE_JSON = !hasFlag('--no-json');
const ALL_TEXT_FIELDS = hasFlag('--all-text-fields');
const SILENT = hasFlag('--silent');
const VERBOSE = hasFlag('--verbose');

const MODEL_FILTER_RAW = [
  ...collectArgValues('--model'),
  ...collectArgValues('--models'),
];

const TEXT_TYPE_KEYS = new Set(['STRING', 'TEXT', 'CHAR']);
const JSON_TYPE_KEYS = new Set(['JSON', 'JSONB']);

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const MOJIBAKE_PATTERN =
  /(?:\u00C3|\u00C2|\u00E2\u20AC|\u00F0\u0178|\u00EF\u00B8|\uFFFD|\u00EF\u00BF\u00BD)/u;

// Unicode code point -> Windows-1252 byte value.
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

const TARGET_FIELDS_BY_MODEL = {
  Activity: ['title', 'message', 'metadata'],
  Category: ['name', 'description'],
  Country: ['name'],
  Evidence: ['originalName', 'notes'],
  Franchise: ['legalName'],
  Notification: ['title', 'message', 'metadata'],
  Order: ['notes', 'shippingAddress', 'billingAddress'],
  OrderItem: ['name'],
  Product: ['name', 'shortDescription', 'description'],
  Project: ['title', 'description'],
  ProjectDocument: ['originalName', 'title', 'notes'],
  ProjectPhase: ['title', 'description'],
  Property: ['title', 'description', 'address', 'city'],
  Region: ['name'],
  Service: ['title', 'description', 'contactPerson', 'address'],
  Task: ['title', 'description'],
  Transaction: ['description'],
  User: ['firstName', 'lastName', 'country'],
};

const ALL_TEXT_FIELDS_EXCLUDED = new Set([
  'email',
  'passwordHash',
  'tokenHash',
  'codeHash',
  'jti',
  'mimeType',
  'filePath',
  'fileId',
  'thumbnailPath',
  'coverImage',
  'slug',
  'sku',
  'currency',
  'isoCode',
  'defaultLanguage',
  'language',
  'paymentMethod',
  'paymentRef',
  'postalCode',
  'contactPhone',
  'phone',
  'userAgent',
  'createdByIp',
  'usedByIp',
  'revokedByIp',
]);

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toWindows1252Bytes(input) {
  const out = [];
  for (const char of input) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0xff) {
      out.push(codePoint);
      continue;
    }

    const mapped = CP1252_EXTENDED_MAP[codePoint];
    if (mapped === undefined) return null;
    out.push(mapped);
  }
  return Uint8Array.from(out);
}

function countMojibakeMarkers(value) {
  if (typeof value !== 'string' || !value) return 0;
  return (value.match(MOJIBAKE_PATTERN) || []).length;
}

function decodeWindows1252AsUtf8(input) {
  const bytes = toWindows1252Bytes(input);
  if (!bytes) return input;
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (_err) {
    return input;
  }
}

function fixMojibakeText(value) {
  if (typeof value !== 'string' || !value) return value;
  if (!MOJIBAKE_PATTERN.test(value)) return value;

  const decoded = decodeWindows1252AsUtf8(value);
  if (!decoded || decoded === value) return value;

  const before = countMojibakeMarkers(value);
  const after = countMojibakeMarkers(decoded);
  return after < before ? decoded : value;
}

function fixMojibakeDeep(value, seen = new WeakSet()) {
  if (typeof value === 'string') return fixMojibakeText(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

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

  if (!isPlainObject(value)) return value;

  let changed = false;
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    const fixed = fixMojibakeDeep(item, seen);
    next[key] = fixed;
    if (fixed !== item) changed = true;
  }
  return changed ? next : value;
}

function getTypeKey(attribute) {
  return String(attribute?.type?.key || '').toUpperCase();
}

function normalizeFieldList(modelName, model) {
  const attributes = model.rawAttributes || {};

  if (ALL_TEXT_FIELDS) {
    return Object.keys(attributes).filter((fieldName) => {
      if (ALL_TEXT_FIELDS_EXCLUDED.has(fieldName)) return false;
      const typeKey = getTypeKey(attributes[fieldName]);
      if (TEXT_TYPE_KEYS.has(typeKey)) return true;
      if (INCLUDE_JSON && JSON_TYPE_KEYS.has(typeKey)) return true;
      return false;
    });
  }

  const curated = TARGET_FIELDS_BY_MODEL[modelName] || [];
  return curated.filter((fieldName) => {
    const attr = attributes[fieldName];
    if (!attr) return false;
    const typeKey = getTypeKey(attr);
    if (TEXT_TYPE_KEYS.has(typeKey)) return true;
    if (INCLUDE_JSON && JSON_TYPE_KEYS.has(typeKey)) return true;
    return false;
  });
}

function buildOrder(model) {
  const pks = model.primaryKeyAttributes || [];
  const validPk = pks.filter((name) => model.rawAttributes?.[name]);
  if (validPk.length) return validPk.map((name) => [name, 'ASC']);
  if (model.rawAttributes?.id) return [['id', 'ASC']];
  return [];
}

function canUseKeyset(model) {
  const pks = model.primaryKeyAttributes || [];
  if (pks.length !== 1) return false;
  const pkAttr = model.rawAttributes?.[pks[0]];
  const key = getTypeKey(pkAttr);
  return key === 'INTEGER' || key === 'BIGINT';
}

function getPkLabel(model, row) {
  const pks = model.primaryKeyAttributes || ['id'];
  return pks.map((pk) => `${pk}=${row.get(pk)}`).join(', ');
}

function toPreview(value, maxLen = 140) {
  if (value === null || value === undefined) return String(value);
  const raw =
    typeof value === 'string' ? value : JSON.stringify(value);
  const singleLine = String(raw).replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLen
    ? `${singleLine.slice(0, maxLen - 3)}...`
    : singleLine;
}

function withQueryLogging(options = {}) {
  if (!SILENT) return options;
  return {
    ...options,
    logging: false,
  };
}

async function processModel(modelName, model) {
  const fields = normalizeFieldList(modelName, model);
  if (!fields.length) return null;

  const order = buildOrder(model);
  const keyset = canUseKeyset(model);
  const pkField = keyset ? model.primaryKeyAttributes[0] : null;
  const attributes = Array.from(
    new Set([...(model.primaryKeyAttributes || ['id']), ...fields])
  );

  let scannedRows = 0;
  let rowsWithFix = 0;
  let rowsUpdated = 0;
  let fieldsUpdated = 0;
  let offset = 0;
  let lastPkValue = null;

  const samples = [];

  while (true) {
    const query = {
      attributes,
      limit: BATCH_SIZE,
    };

    if (order.length) query.order = order;
    if (keyset && lastPkValue !== null) {
      query.where = { [pkField]: { [Op.gt]: lastPkValue } };
    } else if (!keyset) {
      query.offset = offset;
    }

    const rows = await model.findAll(withQueryLogging(query));
    if (!rows.length) break;

    for (const row of rows) {
      scannedRows += 1;
      if (keyset) {
        lastPkValue = row.get(pkField);
      }

      const changes = {};
      for (const fieldName of fields) {
        const attr = model.rawAttributes[fieldName];
        const typeKey = getTypeKey(attr);
        const currentValue = row.get(fieldName);
        if (currentValue === null || currentValue === undefined) continue;

        let nextValue = currentValue;
        if (typeof currentValue === 'string' && TEXT_TYPE_KEYS.has(typeKey)) {
          nextValue = fixMojibakeText(currentValue);
        } else if (INCLUDE_JSON && JSON_TYPE_KEYS.has(typeKey)) {
          nextValue = fixMojibakeDeep(currentValue);
        }

        if (nextValue !== currentValue) {
          changes[fieldName] = nextValue;
          if (samples.length < SAMPLE_LIMIT) {
            samples.push({
              row: getPkLabel(model, row),
              field: fieldName,
              before: toPreview(currentValue),
              after: toPreview(nextValue),
            });
          }
        }
      }

      const changedFields = Object.keys(changes);
      if (!changedFields.length) continue;

      rowsWithFix += 1;
      fieldsUpdated += changedFields.length;

      if (!DRY_RUN) {
        for (const fieldName of changedFields) {
          row.set(fieldName, changes[fieldName]);
        }
        await row.save(
          withQueryLogging({
            hooks: false,
            validate: false,
            silent: true,
          })
        );
        rowsUpdated += 1;
      }

      if (VERBOSE) {
        console.log(
          `[${modelName}] ${DRY_RUN ? 'would-fix' : 'fixed'} row ${getPkLabel(model, row)} (${changedFields.join(', ')})`
        );
      }
    }

    if (!keyset) {
      offset += rows.length;
    }
  }

  return {
    model: modelName,
    fields,
    scannedRows,
    rowsWithFix,
    rowsUpdated,
    fieldsUpdated,
    samples,
  };
}

async function main() {
  const mode = DRY_RUN ? 'dry-run' : 'apply';
  console.log(`fix-mojibake-data: start (${mode})`);
  console.log(
    `options: batchSize=${BATCH_SIZE}, includeJson=${INCLUDE_JSON}, allTextFields=${ALL_TEXT_FIELDS}, silent=${SILENT}`
  );

  if (SILENT && db?.sequelize?.options) {
    db.sequelize.options.logging = false;
  }

  const availableModelEntries = Object.entries(db)
    .filter(([, model]) => model && model.rawAttributes)
    .sort(([a], [b]) => a.localeCompare(b));

  const availableModelNameByLower = new Map(
    availableModelEntries.map(([modelName]) => [modelName.toLowerCase(), modelName])
  );

  const normalizedModelFilter = new Set();
  const unknownModels = [];
  for (const requestedModelName of MODEL_FILTER_RAW) {
    const normalized = availableModelNameByLower.get(
      String(requestedModelName).toLowerCase()
    );
    if (!normalized) {
      unknownModels.push(requestedModelName);
      continue;
    }
    normalizedModelFilter.add(normalized);
  }

  if (unknownModels.length) {
    console.error(`Unknown model(s): ${unknownModels.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const modelEntries = availableModelEntries.filter(([modelName]) => {
    if (normalizedModelFilter.size === 0) return true;
    return normalizedModelFilter.has(modelName);
  });

  if (!modelEntries.length) {
    console.log('No matching model found. Nothing to do.');
    return;
  }

  await db.sequelize.authenticate(withQueryLogging());

  let totalScanned = 0;
  let totalRowsWithFix = 0;
  let totalRowsUpdated = 0;
  let totalFieldsUpdated = 0;

  for (const [modelName, model] of modelEntries) {
    const result = await processModel(modelName, model);
    if (!result) continue;

    totalScanned += result.scannedRows;
    totalRowsWithFix += result.rowsWithFix;
    totalRowsUpdated += result.rowsUpdated;
    totalFieldsUpdated += result.fieldsUpdated;

    console.log(
      `[${modelName}] scanned=${result.scannedRows} rowsWithFix=${result.rowsWithFix} ${DRY_RUN ? 'rowsUpdated=0' : `rowsUpdated=${result.rowsUpdated}`} fieldsUpdated=${result.fieldsUpdated}`
    );
    console.log(`[${modelName}] fields: ${result.fields.join(', ')}`);

    if (result.samples.length) {
      for (const sample of result.samples) {
        console.log(
          `[${modelName}] sample ${sample.row} ${sample.field}: "${sample.before}" => "${sample.after}"`
        );
      }
    }
  }

  console.log('----------------------------------------');
  console.log(`total scanned rows: ${totalScanned}`);
  console.log(`total rows with fix: ${totalRowsWithFix}`);
  console.log(`total fields updated: ${totalFieldsUpdated}`);
  console.log(
    `total rows updated: ${DRY_RUN ? 0 : totalRowsUpdated}`
  );
  console.log(`fix-mojibake-data: done (${mode})`);
}

main()
  .then(async () => {
    await db.sequelize.close();
  })
  .catch(async (err) => {
    console.error('fix-mojibake-data: error', err);
    try {
      await db.sequelize.close();
    } catch (_closeErr) {
      // noop
    }
    process.exit(1);
  });
