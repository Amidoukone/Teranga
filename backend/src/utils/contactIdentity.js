'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{6,20}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const compact = raw.replace(/[\s().-]/g, '').replace(/[^\d+]/g, '');
  if (!compact) return '';

  const hasLeadingPlus = compact.startsWith('+');
  const digits = compact.replace(/\D/g, '');
  if (!digits) return '';

  if (!hasLeadingPlus && digits.startsWith('00') && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

function isValidPhone(value) {
  return PHONE_RE.test(normalizePhone(value));
}

function normalizeOptionalPhone(value) {
  const normalized = normalizePhone(value);
  return normalized || null;
}

function normalizeOptionalEmail(value) {
  const normalized = normalizeEmail(value);
  return normalized || null;
}

module.exports = {
  EMAIL_RE,
  PHONE_RE,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  normalizeOptionalPhone,
  normalizeOptionalEmail,
};
