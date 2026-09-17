"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Shipments", "estimatedDeliveryAt", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("Shipments", "estimatedCollectionAt", { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Shipments", "estimatedCollectionAt");
    await queryInterface.removeColumn("Shipments", "estimatedDeliveryAt");
  },
};
