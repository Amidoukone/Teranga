import { optimizeImageForUpload } from "./imageUpload";

test("optimizeImageForUpload keeps small images unchanged", async () => {
  const file = new File(["small"], "photo.jpg", { type: "image/jpeg" });
  await expect(optimizeImageForUpload(file)).resolves.toBe(file);
});

test("optimizeImageForUpload never modifies PDF documents", async () => {
  const file = new File([new Uint8Array(2 * 1024 * 1024)], "permis.pdf", {
    type: "application/pdf",
  });
  await expect(optimizeImageForUpload(file)).resolves.toBe(file);
});
