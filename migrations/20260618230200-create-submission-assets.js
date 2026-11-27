"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SubmissionAssets", {
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

      revisionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "SubmissionRevisions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Media", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      usageType: {
        type: Sequelize.ENUM("final_video", "raw_video", "image"),
        allowNull: false,
      },

      assetName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      sortOrder: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addIndex("SubmissionAssets", ["publicId"], {
      unique: true,
      name: "idx_submissionAsset_publicId",
    });

    await queryInterface.addIndex("SubmissionAssets", ["revisionId"], {
      name: "idx_submissionAsset_revisionId",
    });

    await queryInterface.addIndex("SubmissionAssets", ["mediaId"], {
      name: "idx_submissionAsset_mediaId",
    });

    await queryInterface.addIndex("SubmissionAssets", ["usageType"], {
      name: "idx_submissionAsset_usageType",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("SubmissionAssets");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SubmissionAssets_usageType";'
    );
  },
};
