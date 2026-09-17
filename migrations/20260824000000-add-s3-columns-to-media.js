"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Media", "storageKey", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: "Canonical S3 object key for provider='s3' records. NULL for Cloudinary records.",
    });

    await queryInterface.addColumn("Media", "s3Bucket", {
      type: Sequelize.STRING(128),
      allowNull: true,
      defaultValue: null,
      comment: "S3 bucket name. Explicit per record for auditability.",
    });

    await queryInterface.addColumn("Media", "mimeType", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
      comment: "Precise MIME type. HeadObject-verified for S3 records.",
    });

    await queryInterface.addColumn("Media", "fileSize", {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
      comment: "File size in bytes. HeadObject-verified for S3 records.",
    });

    await queryInterface.changeColumn("Media", "url", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex("Media", ["storageKey"], {
      name: "idx_media_storageKey",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("Media", "idx_media_storageKey");
    await queryInterface.removeColumn("Media", "storageKey");
    await queryInterface.removeColumn("Media", "s3Bucket");
    await queryInterface.removeColumn("Media", "mimeType");
    await queryInterface.removeColumn("Media", "fileSize");
    await queryInterface.changeColumn("Media", "url", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
