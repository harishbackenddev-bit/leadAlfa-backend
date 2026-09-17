"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ShippingAddresses", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ownerType: {
        type: Sequelize.ENUM("brand", "creator"),
        allowNull: false,
      },
      ownerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      streetAddress: { type: Sequelize.STRING, allowNull: false },
      localArea: { type: Sequelize.STRING, allowNull: false },
      city: { type: Sequelize.STRING, allowNull: false },
      zone: { type: Sequelize.STRING, allowNull: false },
      country: { type: Sequelize.STRING, allowNull: false, defaultValue: "South Africa" },
      postalCode: { type: Sequelize.STRING, allowNull: false },
      company: { type: Sequelize.STRING, allowNull: true },
      contactName: { type: Sequelize.STRING, allowNull: false },
      contactEmail: { type: Sequelize.STRING, allowNull: true },
      contactMobile: { type: Sequelize.STRING, allowNull: false },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("ShippingAddresses", {
      fields: ["ownerType", "ownerId"],
      type: "unique",
      name: "uniq_shipping_address_owner",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ShippingAddresses");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ShippingAddresses_ownerType";');
  },
};
