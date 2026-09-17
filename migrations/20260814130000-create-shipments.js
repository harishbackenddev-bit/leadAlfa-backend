"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Shipments", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Campaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      brandId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "BrandProfiles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "CreatorProfiles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      weightKg: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
      },
      lengthCm: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      widthCm: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      heightCm: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      // kept as STRING on purpose - courier statuses are not a fixed set
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
      },
      courierName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      serviceLevel: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      quotedAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      chargeableKg: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      paid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      trackingNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      trackingUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      // snapshot at booking time, so a later profile edit cannot rewrite a printed waybill
      deliveryAddress: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      collectionAddress: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      events: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      confirmedReceivedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
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

    await queryInterface.addIndex("Shipments", ["creatorId"], {
      name: "idx_shipments_creator",
    });
    await queryInterface.addIndex("Shipments", ["campaignId"], {
      name: "idx_shipments_campaign",
    });
    await queryInterface.addIndex("Shipments", ["brandId"], {
      name: "idx_shipments_brand",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Shipments");
  },
};
