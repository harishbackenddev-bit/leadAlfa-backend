"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = {
      providerSlug: { type: Sequelize.STRING, allowNull: true },
      serviceLevelCode: { type: Sequelize.STRING, allowNull: true },
      bobgoShipmentId: { type: Sequelize.STRING, allowNull: true },
      submissionStatus: { type: Sequelize.STRING, allowNull: true },
      failedReason: { type: Sequelize.TEXT, allowNull: true },
      healthStatus: { type: Sequelize.STRING, allowNull: true },
      chargedAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      chargedWeightKg: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      chargeDelta: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      notificationsSent: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    };

    for (const [name, spec] of Object.entries(columns)) {
      await queryInterface.addColumn("Shipments", name, spec);
    }
  },

  async down(queryInterface) {
    const names = [
      "providerSlug", "serviceLevelCode", "bobgoShipmentId", "submissionStatus",
      "failedReason", "healthStatus", "chargedAmount", "chargedWeightKg",
      "chargeDelta", "notificationsSent",
    ];
    for (const name of names) {
      await queryInterface.removeColumn("Shipments", name);
    }
  },
};
