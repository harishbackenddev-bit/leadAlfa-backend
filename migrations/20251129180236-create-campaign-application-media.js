"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CampaignApplicationMedia", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      campaignApplicationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "CampaignApplications", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Media", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      usageType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(
      "CampaignApplicationMedia",
      ["campaignApplicationId", "mediaId", "usageType"],
      {
        unique: true,
        name: "unique_application_media_usage",
      }
    );

    await queryInterface.addIndex(
      "CampaignApplicationMedia",
      ["campaignApplicationId"],
      { name: "idx_appMedia_applicationId" }
    );
    await queryInterface.addIndex("CampaignApplicationMedia", ["mediaId"], {
      name: "idx_appMedia_mediaId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CampaignApplicationMedia");
  },
};
