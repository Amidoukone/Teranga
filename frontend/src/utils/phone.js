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
