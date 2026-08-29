export function buildTelHref(phoneNumber) {
  const raw = String(phoneNumber || "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `tel:+${digits}`;
  if (digits.startsWith("00") && digits.length > 2) return `tel:+${digits.slice(2)}`;
  return `tel:${digits}`;
}

export function buildWhatsappHref(phoneNumber, message = "") {
  const telHref = buildTelHref(phoneNumber);
  if (!telHref) return null;

  const digits = telHref.replace(/^tel:\+?/, "");
  if (!digits) return null;

  const text = String(message || "").trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const COUNTRY_CALLING_CODES = {
  BJ: '229', BF: '226', CA: '1', CI: '225', FR: '33', GH: '233', GM: '220',
  GN: '224', ML: '223', MR: '222', NE: '227', SN: '221', TG: '228', US: '1',
};

export function getPhonePlaceholder(country) {
  const iso = String(country?.isoCode || '').toUpperCase();
  const code = COUNTRY_CALLING_CODES[iso] || String(country?.contactPhone || '').match(/^\+(\d{1,4})/)?.[1];
  return code ? `+${code} â€¦` : '+â€¦';
}

