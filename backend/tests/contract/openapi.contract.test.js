'use strict';

const path = require('path');
const request = require('supertest');
const app = require('../../src/app');

const openapi = require(path.join(__dirname, '..', '..', 'openapi', 'openapi.json'));

function resolveRef(ref) {
  const prefix = '#/components/schemas/';
  if (!ref || !ref.startsWith(prefix)) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }
  const schemaName = ref.slice(prefix.length);
  return openapi.components.schemas[schemaName];
}

function expandSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  if (schema.$ref) {
    return expandSchema(resolveRef(schema.$ref));
  }

  if (schema.type === 'object' && schema.properties) {
    const next = { ...schema, properties: { ...schema.properties } };
    for (const [key, value] of Object.entries(next.properties)) {
      next.properties[key] = expandSchema(value);
    }
    return next;
  }

  if (schema.type === 'array' && schema.items) {
    return { ...schema, items: expandSchema(schema.items) };
  }

  return schema;
}

function getResponseSchema(pathKey, method, statusCode) {
  const operation = openapi.paths[pathKey]?.[method];
  if (!operation) {
    throw new Error(`Missing OpenAPI operation ${method.toUpperCase()} ${pathKey}`);
  }
  const response = operation.responses?.[String(statusCode)];
  const contentSchema = response?.content?.['application/json']?.schema;
  if (!contentSchema) {
    throw new Error(`Missing OpenAPI schema for ${method.toUpperCase()} ${pathKey} ${statusCode}`);
  }
  return expandSchema(contentSchema);
}

function matchesType(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (type === 'null') return value === null;
  return true;
}

function assertSchema(schema, value, pointer = '$') {
  if (!schema || typeof schema !== 'object') return;

  if (Array.isArray(schema.type)) {
    const oneMatches = schema.type.some((candidate) => matchesType(value, candidate));
    expect(oneMatches).toBe(true);
  } else if (schema.type) {
    expect(matchesType(value, schema.type)).toBe(true);
  }

  if (schema.required && matchesType(value, 'object')) {
    for (const key of schema.required) {
      expect(Object.prototype.hasOwnProperty.call(value, key)).toBe(true);
    }
  }

  if (schema.type === 'object' && schema.properties && matchesType(value, 'object')) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        assertSchema(childSchema, value[key], `${pointer}.${key}`);
      }
    }
  }

  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    for (const item of value) {
      assertSchema(schema.items, item, `${pointer}[]`);
    }
  }
}

function assertContract(pathKey, method, statusCode, body) {
  const schema = getResponseSchema(pathKey, method, statusCode);
  assertSchema(schema, body);
}

describe('OpenAPI contract tests', () => {
  test('GET /api/v1/health returns contract-compliant payload', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    assertContract('/health', 'get', 200, res.body);
  });

  test('POST /api/v1/auth/login validation error follows contract', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    assertContract('/auth/login', 'post', 400, res.body);
  });

  test('GET /api/v1/auth/me unauthorized response follows contract', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    assertContract('/auth/me', 'get', 401, res.body);
  });
});
