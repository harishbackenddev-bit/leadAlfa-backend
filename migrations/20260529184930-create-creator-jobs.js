"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CreatorJobs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      publicId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Campaigns", key: "id" },
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

      applicationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "CampaignApplications", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      hiringSource: {
        type: Sequelize.ENUM("campaign_application", "direct_invitation"),
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM(
          "ongoing",
          "submitted",
          "approved",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "ongoing",
      },

      agreedBudget: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      deadlineAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("CreatorJobs", ["publicId"], {
      unique: true,
      name: "idx_creatorJob_publicId",
    });

    await queryInterface.addIndex(
      "CreatorJobs",
      ["campaignId", "creatorId"],
      {
        unique: true,
        name: "unique_creator_job_campaign_creator",
      }
    );

    await queryInterface.addIndex("CreatorJobs", ["creatorId"], {
      name: "idx_creatorJob_creatorId",
    });

    await queryInterface.addIndex("CreatorJobs", ["campaignId"], {
      name: "idx_creatorJob_campaignId",
    });

    await queryInterface.addIndex("CreatorJobs", ["status"], {
      name: "idx_creatorJob_status",
    });

    await queryInterface.addIndex("CreatorJobs", ["applicationId"], {
      name: "idx_creatorJob_applicationId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CreatorJobs");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CreatorJobs_hiringSource";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CreatorJobs_status";'
    );
  },
};
