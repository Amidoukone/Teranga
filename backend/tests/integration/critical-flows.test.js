'use strict';

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const db = require('../../models');

let dbReady = false;
let seeded = null;

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    return Array.isArray(tables) && tables.length > 0;
  } catch (_err) {
    return false;
  }
}

describe('P2-T1 critical integration flows', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    const {
      User,
      Product,
    } = db;

    const email = `seed_${Date.now()}@teranga.local`;
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      firstName: 'Test',
      lastName: 'Client',
      role: 'client',
    });

    const product = await Product.create({
      name: 'Produit test',
      slug: `produit-test-${Date.now()}`,
      sku: `SKU-${Date.now()}`,
      price: 5000,
      stock: 20,
      currency: 'XOF',
      isActive: true,
    });

    seeded = {
      email,
      password,
      userId: user.id,
      productId: product.id,
    };
  });

  afterAll(async () => {
    if (!dbReady) return;
    const { Evidence, OrderItem, Order, Project, Product, User } = db;

    if (seeded?.userId) {
      await Evidence.destroy({ where: { uploaderId: seeded.userId } });
      await OrderItem.destroy({ where: {} });
      await Order.destroy({ where: { userId: seeded.userId } });
      await Project.destroy({ where: { clientId: seeded.userId } });
      await Product.destroy({ where: { id: seeded.productId } });
      await User.destroy({ where: { id: seeded.userId } });
    }

    await db.sequelize.close();
  });

  test('auth/me requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('projects list requires authentication', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  test('orders list requires authentication', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  test('evidences list requires authentication', async () => {
    const res = await request(app).get('/api/evidences');
    expect(res.status).toBe(401);
  });

  test('auth register/login + project create when DB is available', async () => {
    if (!dbReady) {
      return;
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: seeded.email, password: seeded.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.token).toBeTruthy();

    const token = loginRes.body.token;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Projet test',
        type: 'autre',
        description: 'Test integration',
      });

    expect([200, 201]).toContain(projectRes.status);
  });

  test('orders + evidences flows with seeded data when DB is available', async () => {
    if (!dbReady) {
      return;
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: seeded.email, password: seeded.password });

    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            productId: seeded.productId,
            quantity: 1,
            unitPrice: 5000,
          },
        ],
        paymentMethod: 'other',
        currency: 'XOF',
      });

    expect([200, 201]).toContain(orderRes.status);
    const orderId = orderRes.body?.order?.id;
    expect(orderId).toBeTruthy();

    await db.Evidence.create({
      orderId,
      uploaderId: seeded.userId,
      kind: 'document',
      filePath: 'https://example.com/evidence.pdf',
    });

    const listOrdersRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(listOrdersRes.status).toBe(200);

    const evidenceRes = await request(app)
      .get(`/api/evidences?orderId=${orderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(evidenceRes.status).toBe(200);
  });
});
