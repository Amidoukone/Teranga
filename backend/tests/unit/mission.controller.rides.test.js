"use strict";

jest.mock("../../models", () => ({
  Service: { findAndCountAll: jest.fn() },
  User: {},
  TradeCategory: { findAll: jest.fn() },
  SavedLocation: {},
  Evidence: {},
  Provider: {},
  MissionRating: {},
  Vehicle: {},
  ExecutorLocation: {},
}));

jest.mock("../../src/services/mediaUpload.service", () => ({}));
jest.mock("../../src/services/geocoding.service", () => ({}));
jest.mock("../../src/services/priceEstimate.service", () => ({}));
jest.mock("../../src/services/serviceNotification.service", () => ({}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Service, TradeCategory } = require("../../models");
const ctrl = require("../../src/controllers/mission.controller");

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() };
}

describe("mission.controller dedicated transport lists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TradeCategory.findAll.mockResolvedValue([{ id: 9 }]);
    Service.findAndCountAll.mockResolvedValue({ rows: [{ id: 31 }], count: 1 });
  });

  test("myRides is strictly scoped to the connected client and Mobility", async () => {
    const req = { user: { id: 7, role: "client" }, query: {} };
    const res = makeRes();

    await ctrl.myRides(req, res);

    expect(TradeCategory.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "mobilite" } }),
    );
    expect(Service.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 7, parentServiceId: null }),
        order: [["createdAt", "DESC"]],
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rides: [{ id: 31 }],
        pagination: expect.objectContaining({ total: 1 }),
      }),
    );
  });

  test("dispatchRides applies the admin geographic scope", async () => {
    const req = {
      user: { id: 2, role: "admin", countryId: 4, regionId: 18 },
      query: {},
    };
    const res = makeRes();

    await ctrl.dispatchRides(req, res);

    expect(Service.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ regionId: 18, parentServiceId: null }),
        order: [["createdAt", "ASC"]],
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rides: [{ id: 31 }],
        pagination: expect.objectContaining({ total: 1 }),
      }),
    );
  });

  test("myDeliveries is strictly scoped to the connected client and Delivery", async () => {
    const req = { user: { id: 8, role: "client" }, query: {} };
    const res = makeRes();

    await ctrl.myDeliveries(req, res);

    expect(TradeCategory.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "livraison" } }),
    );
    expect(Service.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 8, parentServiceId: null }),
        order: [["createdAt", "DESC"]],
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveries: [{ id: 31 }],
        pagination: expect.objectContaining({ total: 1 }),
      }),
    );
  });

  test('the active work filter preserves the assigned agent scope before pagination', async () => {
    const { Op } = require('sequelize');
    const req = { user: { id: 7, role: 'agent' }, query: { view: 'active', limit: '100' } };
    await ctrl.mine(req, makeRes());
    const options = Service.findAndCountAll.mock.calls[0][0];
    expect(options.where.agentId).toBe(7);
    expect(options.where.missionStatus[Op.ne]).toBeNull();
    expect(options.where[Op.and][0].missionStatus[Op.notIn]).toContain('VALIDATED');
    expect(options.where[Op.and][0].missionStatus[Op.notIn]).not.toContain('COMPLETED');
  });

  test('history filtering cannot grant a client access to the executor list', async () => {
    const res = makeRes();
    await ctrl.mine({ user: { id: 7, role: 'client' }, query: { view: 'history' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Service.findAndCountAll).not.toHaveBeenCalled();
  });
});
