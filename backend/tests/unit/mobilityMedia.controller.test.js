"use strict";

jest.mock("../../models", () => ({
  Provider: { findByPk: jest.fn() },
}));

jest.mock("../../src/services/mediaUpload.service", () => ({
  buildFileName: jest.fn((prefix, name) => `${prefix}_${name}`),
  isImageKitEnabled: jest.fn(),
  resolveLocalFallbackPolicy: jest.fn(),
  uploadToImageKitWithRetry: jest.fn(),
  saveFileLocally: jest.fn(),
  mediaStorageError: jest.fn((message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
  }),
}));

jest.mock("../../src/utils/providerScope", () => ({
  canManageProvider: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Provider } = require("../../models");
const mediaUpload = require("../../src/services/mediaUpload.service");
const { canManageProvider } = require("../../src/utils/providerScope");
const controller = require("../../src/controllers/mobilityMedia.controller");

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function makeRequest(overrides = {}) {
  return {
    params: { id: "17" },
    user: { id: 1, role: "admin" },
    body: { kind: "profilePhoto" },
    file: {
      originalname: "chauffeur.jpg",
      mimetype: "image/jpeg",
      buffer: Buffer.from("photo"),
    },
    ...overrides,
  };
}

describe("mobilityMedia.controller.upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Provider.findByPk.mockResolvedValue({ id: 17 });
    canManageProvider.mockResolvedValue(true);
    mediaUpload.isImageKitEnabled.mockReturnValue(false);
    mediaUpload.resolveLocalFallbackPolicy.mockReturnValue({ allowLocalFallback: true });
    mediaUpload.saveFileLocally.mockResolvedValue({
      url: "/uploads/mobility/driver_profile_chauffeur.jpg",
      fileId: null,
    });
  });

  test("stores a gallery photo through the existing local fallback", async () => {
    const res = makeRes();
    await controller.upload(makeRequest(), res);

    expect(mediaUpload.saveFileLocally).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: "chauffeur.jpg" }),
      "driver_profile_chauffeur.jpg",
      { subfolder: "mobility" }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      media: expect.objectContaining({
        kind: "profilePhoto",
        url: "/uploads/mobility/driver_profile_chauffeur.jpg",
      }),
    });
  });

  test("rejects a PDF when a photo is required", async () => {
    const res = makeRes();
    await controller.upload(
      makeRequest({
        file: {
          originalname: "photo.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("pdf"),
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mediaUpload.saveFileLocally).not.toHaveBeenCalled();
  });

  test("does not expose uploads outside the administrator scope", async () => {
    canManageProvider.mockResolvedValue(false);
    const res = makeRes();
    await controller.upload(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mediaUpload.saveFileLocally).not.toHaveBeenCalled();
  });

  test("returns 503 when durable storage is unavailable", async () => {
    mediaUpload.resolveLocalFallbackPolicy.mockReturnValue({ allowLocalFallback: false });
    const res = makeRes();
    await controller.upload(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Stockage") })
    );
  });
});
