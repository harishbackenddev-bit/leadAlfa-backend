"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SubmissionRevisions", {
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

      submissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "WorkSubmissions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      revisionNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM(
          "pending_review",
          "approved",
          "revision_requested",
          "rejected"
        ),
        allowNull: false,
        defaultValue: "pending_review",
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      captionOrHook: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      revisionFeedback: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      reviewDeadline: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      lastReminderSentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      submittedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      submittedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      reviewedByBrandId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "BrandProfiles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("SubmissionRevisions", ["publicId"], {
      unique: true,
      name: "idx_submissionRevision_publicId",
    });

    await queryInterface.addIndex(
      "SubmissionRevisions",
      ["submissionId", "revisionNumber"],
      {
        unique: true,
        name: "unique_submission_revisionNumber",
      }
    );

    await queryInterface.addIndex("SubmissionRevisions", ["submissionId"], {
      name: "idx_submissionRevision_submissionId",
    });

    await queryInterface.addIndex("SubmissionRevisions", ["status"], {
      name: "idx_submissionRevision_status",
    });

    await queryInterface.addIndex("SubmissionRevisions", ["reviewDeadline"], {
      name: "idx_submissionRevision_reviewDeadline",
    });

    await queryInterface.addIndex(
      "SubmissionRevisions",
      ["submittedByUserId"],
      {
        name: "idx_submissionRevision_submittedByUserId",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("SubmissionRevisions");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SubmissionRevisions_status";'
    );
  },
};
