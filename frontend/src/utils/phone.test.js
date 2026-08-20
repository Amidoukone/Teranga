import { buildTelHref, buildWhatsappHref } from "./phone";

test("buildTelHref removes display formatting and preserves international dialing", () => {
  expect(buildTelHref("+223 20 00 00 00")).toBe("tel:+22320000000");
  expect(buildTelHref("00221 33 800 00 00")).toBe("tel:+221338000000");
  expect(buildTelHref("70-00-00-00")).toBe("tel:70000000");
});

test("buildTelHref rejects empty phone values", () => {
  expect(buildTelHref(" ")).toBeNull();
  expect(buildTelHref(null)).toBeNull();
});

test("buildWhatsappHref creates an international click-to-chat link", () => {
  expect(buildWhatsappHref("+223 20 00 00 00", "Bonjour Teranga"))
    .toBe("https://wa.me/22320000000?text=Bonjour%20Teranga");
  expect(buildWhatsappHref("00221 33 800 00 00"))
    .toBe("https://wa.me/221338000000");
  expect(buildWhatsappHref(null, "Bonjour")).toBeNull();
});
