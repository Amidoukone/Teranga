'use strict';

const {
  evaluateLocalMediaFallback,
  parseBooleanEnv,
} = require('../../src/utils/mediaStoragePolicy');

describe('mediaStoragePolicy', () => {
  test('parseBooleanEnv handles true/false variants', () => {
    expect(parseBooleanEnv('true')).toBe(true);
    expect(parseBooleanEnv('1')).toBe(true);
    expect(parseBooleanEnv('YES')).toBe(true);
    expect(parseBooleanEnv('false')).toBe(false);
    expect(parseBooleanEnv('0')).toBe(false);
    expect(parseBooleanEnv('off')).toBe(false);
    expect(parseBooleanEnv('')).toBeNull();
    expect(parseBooleanEnv(undefined)).toBeNull();
  });

  test('allows fallback by default in non-production', () => {
    const result = evaluateLocalMediaFallback({
      env: { NODE_ENV: 'test' },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(true);
    expect(result.reason).toBe('non_production_default');
  });

  test('blocks fallback by default in production', () => {
    const result = evaluateLocalMediaFallback({
      env: { NODE_ENV: 'production' },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(false);
    expect(result.reason).toBe('production_default_durable');
  });

  test('blocks fallback in production by default when ImageKit is configured', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'production',
        IMAGEKIT_PUBLIC_KEY: 'pk_test',
        IMAGEKIT_PRIVATE_KEY: 'sk_test',
        IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/teranga',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(false);
    expect(result.reason).toBe('production_imagekit_default');
    expect(result.imageKitConfigured).toBe(true);
  });

  test('allows fallback in production when uploads root is explicitly configured', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'production',
        MEDIA_ENFORCE_DURABLE_UPLOADS: 'true',
        UPLOADS_ROOT: '/var/lib/teranga-uploads',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(true);
    expect(result.reason).toBe('custom_uploads_root');
  });

  test('module-level env override has priority over defaults', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'test',
        PROPERTY_ALLOW_LOCAL_FALLBACK: 'false',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(false);
    expect(result.reason).toBe('explicit_module_env');
    expect(result.resolvedFrom).toBe('PROPERTY_ALLOW_LOCAL_FALLBACK');
  });

  test('global env override applies when module override is not set', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'production',
        MEDIA_ALLOW_LOCAL_FALLBACK: 'true',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(true);
    expect(result.reason).toBe('explicit_global_env');
    expect(result.resolvedFrom).toBe('MEDIA_ALLOW_LOCAL_FALLBACK');
  });

  test('explicit durable disable enables fallback in production', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'production',
        MEDIA_ENFORCE_DURABLE_UPLOADS: 'false',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(true);
    expect(result.reason).toBe('explicit_durable_enforcement_disabled');
    expect(result.resolvedFrom).toBe('MEDIA_ENFORCE_DURABLE_UPLOADS');
  });

  test('blocks fallback in production when durable mode is explicitly enforced', () => {
    const result = evaluateLocalMediaFallback({
      env: {
        NODE_ENV: 'production',
        MEDIA_ENFORCE_DURABLE_UPLOADS: 'true',
      },
      moduleFallbackEnvVar: 'PROPERTY_ALLOW_LOCAL_FALLBACK',
    });

    expect(result.allowLocalFallback).toBe(false);
    expect(result.reason).toBe('production_ephemeral_blocked');
    expect(result.enforceDurableUploads).toBe(true);
  });
});
