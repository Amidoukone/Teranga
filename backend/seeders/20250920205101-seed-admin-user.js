'use strict';
const bcrypt = require('bcrypt');

function seedEmail() {
  if (!['development', 'test'].includes(process.env.NODE_ENV || 'development')) {
    throw new Error('Administrative seeding is local only. Use the controlled production bootstrap.');
  }
  const email = String(process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('SEED_ADMIN_EMAIL is required');
  return email;
}

module.exports = {
  async up(queryInterface) {
    const email = seedEmail();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.trim().length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('SEED_ADMIN_PASSWORD must contain at least 16 characters and at most 72 UTF-8 bytes');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return queryInterface.bulkInsert('users', [{
      email, passwordHash, firstName: 'Super', lastName: 'Admin', role: 'admin',
      emailVerified: true, createdAt: new Date(), updatedAt: new Date(),
    }], {});
  },
  async down(queryInterface) {
    const email = seedEmail();
    return queryInterface.bulkDelete('users', { email, role: 'admin' }, {});
  },
};
