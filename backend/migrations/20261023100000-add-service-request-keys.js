'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('services');
    if (!columns.client_request_key) await queryInterface.addColumn('services', 'client_request_key', { type: Sequelize.STRING(80), allowNull: true });
    if (!columns.request_payload_hash) await queryInterface.addColumn('services', 'request_payload_hash', { type: Sequelize.STRING(64), allowNull: true });
    const indexes = await queryInterface.showIndex('services');
    if (!indexes.some((index) => index.name === 'uniq_services_client_request')) await queryInterface.addIndex('services', ['clientId', 'client_request_key'], { name: 'uniq_services_client_request', unique: true });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('services', 'uniq_services_client_request');
    await queryInterface.removeColumn('services', 'client_request_key');
    await queryInterface.removeColumn('services', 'request_payload_hash');
  },
};
