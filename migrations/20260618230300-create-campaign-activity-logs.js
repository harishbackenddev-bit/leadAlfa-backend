"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CampaignActivityLogs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Campaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      actorType: {
        type: Sequelize.ENUM("creator", "brand", "system"),
        allowNull: false,
      },

      actorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      eventType: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("CampaignActivityLogs", ["campaignId"], {
      name: "idx_activityLog_campaignId",
    });

    await queryInterface.addIndex("CampaignActivityLogs", ["expiresAt"], {
      name: "idx_activityLog_expiresAt",
    });

    await queryInterface.addIndex("CampaignActivityLogs", ["eventType"], {
      name: "idx_activityLog_eventType",
    });

    await queryInterface.addIndex("CampaignActivityLogs", ["actorType"], {
      name: "idx_activityLog_actorType",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CampaignActivityLogs");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CampaignActivityLogs_actorType";'
    );
  },
};
