"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Campaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      brandId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "BrandProfiles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      campaignTitle: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      deliverables: {
        type: Sequelize.ENUM("image", "video"),
        allowNull: false,
      },

      campaignBrief: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      socialMediaType: {
        type: Sequelize.ENUM("instagram", "tiktok", "facebook", "youtube"),
        allowNull: false,
      },

      videoAspectRatio: {
        type: Sequelize.ENUM("1:1", "4:5", "9:16", "16:9"),
        allowNull: true,
      },

      videoLength: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      countryPreferences: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      creatorsNeeded: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      productUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      budgetValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },

      additionalBrief: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      campaignRules: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM("inactive", "active", "closed"),
        defaultValue: "active",
        allowNull: false,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("Campaigns", ["brandId"], {
      name: "idx_campaign_brandId",
      unique: true,
    });

    await queryInterface.addIndex("Campaigns", ["status"], {
      name: "idx_campaign_status",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Campaigns");

    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Campaigns_deliverables";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Campaigns_socialMediaType";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Campaigns_videoAspectRatio";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Campaigns_status";`
    );
  },
};
