const DEFAULT_COMPRESSION_THRESHOLD = 1.2 * 1024 * 1024;

function loadBrowserImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image illisible"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

export async function optimizeImageForUpload(
  file,
  { maxDimension = 1800, quality = 0.82, thresholdBytes = DEFAULT_COMPRESSION_THRESHOLD } = {}
) {
  if (!file || file.size <= thresholdBytes) return file;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  if (typeof document === "undefined" || typeof Image === "undefined") return file;

  try {
    const image = await loadBrowserImage(file);
    const largestDimension = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largestDimension > maxDimension ? maxDimension / largestDimension : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob || blob.size >= file.size) return file;
    const baseName = String(file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch (_error) {
    return file;
  }
}
