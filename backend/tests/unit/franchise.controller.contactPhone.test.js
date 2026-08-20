"use strict";

jest.mock("../../models", () => ({
  Franchise: { findAll: jest.fn() },
  Country: { findAll: jest.fn() },
  Region: { findAll: jest.fn() },
  User: { findAll: jest.fn() },
}));

jest.mock("../../src/utils/geoScope", () => ({
  getUserGeoScope: jest.fn(),
  isGlobalAdmin: jest.fn(),
  canAccessGeoResource: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Franchise, Country, User } = require("../../models");
const controller = require("../../src/controllers/franchise.controller");

test("listMasterCountries exposes the configured assistance phone", async () => {
  Franchise.findAll.mockResolvedValue([{ countryId: 5 }]);
  User.findAll.mockResolvedValue([]);
  Country.findAll.mockResolvedValue([
    { id: 5, name: "Mali", isoCode: "ML", contactPhone: "+223 20 00 00 00" },
  ]);
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);

  await controller.listMasterCountries({}, res);

  expect(Country.findAll.mock.calls[0][0].attributes).toContain("contactPhone");
  expect(res.json).toHaveBeenCalledWith({
    countries: [
      expect.objectContaining({
        id: 5,
        isoCode: "ML",
        contactPhone: "+223 20 00 00 00",
      }),
    ],
  });
});
