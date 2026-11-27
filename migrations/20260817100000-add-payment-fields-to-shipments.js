"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Shipments", "paymentReference", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Shipments", "pfPaymentId", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex("Shipments", ["paymentReference"], {
      name: "idx_shipments_payment_reference",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Shipments", "idx_shipments_payment_reference");
    await queryInterface.removeColumn("Shipments", "pfPaymentId");
    await queryInterface.removeColumn("Shipments", "paymentReference");
  },
};
