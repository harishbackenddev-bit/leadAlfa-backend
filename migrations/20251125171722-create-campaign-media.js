'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.createTable("CampaignMedia", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Campaigns",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Media",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      usageType: {
        type: Sequelize.STRING,
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

    await queryInterface.addIndex("CampaignMedia", ["campaignId"], {
      name: "idx_campaignMedia_campaignId",
    });

    await queryInterface.addIndex("CampaignMedia", ["mediaId"], {
      name: "idx_campaignMedia_mediaId",
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable("CampaignMedia");
  }
};
