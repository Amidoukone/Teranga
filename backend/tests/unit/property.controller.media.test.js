'use strict';

const fs = require('fs');

jest.mock('../../models', () => ({
  Property: {
    findByPk: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Country: {
    findOne: jest.fn(),
  },
  Sequelize: {
    fn: jest.fn(),
    col: jest.fn(),
    where: jest.fn(),
  },
}));

jest.mock('../../src/helpers/teranga-imagekit', () => ({
  upload: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  canAccessGeoResource: jest.fn(() => true),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => false),
}));

jest.mock('../../src/utils/pagination', () => ({
  getPagination: jest.fn(() => ({ limit: 50, offset: 0, page: 1 })),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Property } = require('../../models');
const imageKit = require('../../src/helpers/teranga-imagekit');
const controller = require('../../src/controllers/property.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('property.controller media handling', () => {
  const envBackup = {
    IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    delete process.env.IMAGEKIT_URL_ENDPOINT;

    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();
    jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
  });

  afterEach(() => {
    fs.promises.mkdir.mockRestore();
    fs.promises.writeFile.mockRestore();
    fs.promises.unlink.mockRestore();

    process.env.IMAGEKIT_PUBLIC_KEY = envBackup.IMAGEKIT_PUBLIC_KEY;
    process.env.IMAGEKIT_PRIVATE_KEY = envBackup.IMAGEKIT_PRIVATE_KEY;
    process.env.IMAGEKIT_URL_ENDPOINT = envBackup.IMAGEKIT_URL_ENDPOINT;
  });

  test('create falls back to local storage when ImageKit is disabled', async () => {
    Property.create.mockResolvedValue({ id: 44 });
    Property.findByPk.mockResolvedValue({
      toJSON: () => ({
        id: 44,
        ownerId: 10,
        title: 'Villa test',
        type: 'house',
        address: 'A',
        city: 'Bamako',
        photos: [{ url: '/uploads/properties/property_demo.pdf', fileId: null }],
        owner: { id: 10, firstName: 'User', lastName: 'Client', email: 'c@test.local' },
      }),
    });

    const req = {
      user: { id: 10, role: 'client', country: null, countryId: null, regionId: null },
      body: {
        title: 'Villa test',
        type: 'house',
        address: 'Rue 1',
        city: 'Bamako',
      },
      files: [
        {
          originalname: 'doc.pdf',
          mimetype: 'application/pdf',
          size: 12,
          buffer: Buffer.from('demo'),
        },
      ],
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(imageKit.upload).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
    expect(Property.create).toHaveBeenCalledTimes(1);
    expect(Property.create.mock.calls[0][0].photos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringMatching(/^\/uploads\/properties\/property_/),
          fileId: null,
        }),
      ])
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        property: expect.objectContaining({
          photos: expect.arrayContaining(['/uploads/properties/property_demo.pdf']),
        }),
      })
    );
  });

  test('update rejects uploads when property already reached 10 files', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    Property.findByPk.mockResolvedValue({
      id: 91,
      ownerId: 7,
      countryId: null,
      regionId: null,
      photos: Array.from({ length: 10 }, (_v, i) => `/uploads/properties/p_${i}.jpg`),
      update,
    });

    const req = {
      params: { id: '91' },
      user: { id: 7, role: 'client' },
      body: {},
      files: [
        {
          originalname: 'new.jpg',
          mimetype: 'image/jpeg',
          size: 22,
          buffer: Buffer.from('img'),
        },
      ],
    };
    const res = makeRes();

    await controller.update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('10'),
      })
    );
    expect(update).not.toHaveBeenCalled();
    expect(imageKit.upload).not.toHaveBeenCalled();
  });

  test('update removes selected media and keeps remaining files', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    Property.findByPk
      .mockResolvedValueOnce({
        id: 92,
        ownerId: 7,
        countryId: null,
        regionId: null,
        photos: [
          { url: '/uploads/properties/keep.jpg', fileId: null },
          { url: '/uploads/properties/remove.pdf', fileId: null },
        ],
        update,
      })
      .mockResolvedValueOnce({
        toJSON: () => ({
          id: 92,
          ownerId: 7,
          title: 'Appartement test',
          type: 'apartment',
          status: 'active',
          city: 'Dakar',
          photos: [{ url: '/uploads/properties/keep.jpg', fileId: null }],
          owner: {
            id: 7,
            firstName: 'Client',
            lastName: 'Test',
            email: 'client@test.local',
          },
        }),
      });

    const req = {
      params: { id: '92' },
      user: { id: 7, role: 'client' },
      body: {
        removePhotos: JSON.stringify(['/uploads/properties/remove.pdf']),
      },
      files: [],
    };
    const res = makeRes();

    await controller.update(req, res);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: [
          expect.objectContaining({ url: '/uploads/properties/keep.jpg' }),
        ],
      })
    );
    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        property: expect.objectContaining({
          photos: ['/uploads/properties/keep.jpg'],
        }),
      })
    );
  });

  test('remove deletes local uploaded files before deleting property row', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Property.findByPk.mockResolvedValue({
      id: 15,
      ownerId: 3,
      photos: [{ url: '/uploads/properties/property_abc.pdf', fileId: null }],
      destroy,
    });

    const req = {
      params: { id: '15' },
      user: { id: 3, role: 'client' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});
