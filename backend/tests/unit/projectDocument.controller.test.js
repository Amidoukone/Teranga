'use strict';

const fs = require('fs');

jest.mock('../../models', () => ({
  ProjectDocument: {
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  Project: {
    findByPk: jest.fn(),
  },
  User: {},
  ProjectPhase: {
    findByPk: jest.fn(),
  },
}));

jest.mock('../../src/helpers/teranga-imagekit', () => ({
  upload: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const models = require('../../models');
const imageKit = require('../../src/helpers/teranga-imagekit');
const controller = require('../../src/controllers/projectDocument.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('projectDocument.controller', () => {
  const envBackup = {
    NODE_ENV: process.env.NODE_ENV,
    IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
    UPLOADS_ROOT: process.env.UPLOADS_ROOT,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK:
      process.env.PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK,
    MEDIA_ENFORCE_DURABLE_UPLOADS: process.env.MEDIA_ENFORCE_DURABLE_UPLOADS,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.UPLOADS_ROOT;
    delete process.env.UPLOADS_DIR;
    delete process.env.PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK;
    delete process.env.MEDIA_ENFORCE_DURABLE_UPLOADS;

    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue();
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();
    jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
  });

  afterEach(() => {
    fs.promises.mkdir.mockRestore();
    fs.promises.writeFile.mockRestore();
    fs.promises.unlink.mockRestore();

    process.env.NODE_ENV = envBackup.NODE_ENV;
    process.env.IMAGEKIT_PUBLIC_KEY = envBackup.IMAGEKIT_PUBLIC_KEY;
    process.env.IMAGEKIT_PRIVATE_KEY = envBackup.IMAGEKIT_PRIVATE_KEY;
    process.env.IMAGEKIT_URL_ENDPOINT = envBackup.IMAGEKIT_URL_ENDPOINT;
    process.env.UPLOADS_ROOT = envBackup.UPLOADS_ROOT;
    process.env.UPLOADS_DIR = envBackup.UPLOADS_DIR;
    process.env.PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK =
      envBackup.PROJECT_DOCUMENT_ALLOW_LOCAL_FALLBACK;
    process.env.MEDIA_ENFORCE_DURABLE_UPLOADS =
      envBackup.MEDIA_ENFORCE_DURABLE_UPLOADS;
  });

  test('upload falls back to local storage and persists a non-null filePath', async () => {
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    delete process.env.IMAGEKIT_URL_ENDPOINT;

    models.Project.findByPk.mockResolvedValue({
      id: 12,
      clientId: 2,
      agentId: null,
      createdAt: new Date().toISOString(),
      countryId: 1,
      regionId: 2,
    });

    models.ProjectDocument.create.mockResolvedValue({ id: 91 });
    models.ProjectDocument.findByPk.mockResolvedValue({
      toJSON: () => ({
        id: 91,
        projectId: 12,
        kind: 'other',
        filePath: '/uploads/projects/project_12_demo.pdf',
        uploader: { id: 1, firstName: 'Admin', lastName: 'Global', email: 'admin@test.local' },
        phase: null,
      }),
    });

    const req = {
      user: { id: 1, role: 'admin' },
      body: { projectId: '12', title: 'spec', kind: 'other', notes: 'n' },
      files: [
        {
          originalname: 'plan.pdf',
          mimetype: 'application/pdf',
          size: 10,
          buffer: Buffer.from('demo'),
        },
      ],
    };
    const res = makeRes();

    await controller.upload(req, res);

    expect(imageKit.upload).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
    expect(models.ProjectDocument.create).toHaveBeenCalledTimes(1);

    const payload = models.ProjectDocument.create.mock.calls[0][0];
    expect(payload.fileId).toBeNull();
    expect(payload.filePath).toMatch(/^\/uploads\/projects\/project_12_/);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 12,
        documents: expect.any(Array),
      })
    );
  });

  test('upload rejects in production when ImageKit is unavailable and uploads root is not configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MEDIA_ENFORCE_DURABLE_UPLOADS = 'true';
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    delete process.env.IMAGEKIT_URL_ENDPOINT;
    delete process.env.UPLOADS_ROOT;
    delete process.env.UPLOADS_DIR;

    models.Project.findByPk.mockResolvedValue({
      id: 12,
      clientId: 2,
      agentId: null,
      createdAt: new Date().toISOString(),
      countryId: 1,
      regionId: 2,
    });

    const req = {
      user: { id: 1, role: 'admin' },
      body: { projectId: '12', title: 'spec', kind: 'other', notes: 'n' },
      files: [
        {
          originalname: 'plan.pdf',
          mimetype: 'application/pdf',
          size: 10,
          buffer: Buffer.from('demo'),
        },
      ],
    };
    const res = makeRes();

    await controller.upload(req, res);

    expect(imageKit.upload).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
    expect(models.ProjectDocument.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Stockage des documents indisponible'),
      })
    );
  });

  test('remove deletes local uploaded file before destroying DB row', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    models.ProjectDocument.findByPk.mockResolvedValue({
      id: 90,
      projectId: 44,
      filePath: '/uploads/projects/project_44_test.pdf',
      fileId: null,
      destroy,
    });
    models.Project.findByPk.mockResolvedValue({
      id: 44,
      clientId: 5,
      agentId: null,
      createdAt: new Date().toISOString(),
      countryId: 1,
      regionId: 2,
    });

    const req = {
      params: { id: '90' },
      user: { id: 1, role: 'admin' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 44,
      })
    );
  });
});
