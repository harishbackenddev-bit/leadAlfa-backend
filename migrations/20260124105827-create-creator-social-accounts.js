"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CreatorSocialAccounts", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CreatorProfiles",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      platform: {
        type: Sequelize.ENUM("instagram", "tiktok"),
        allowNull: false,
      },

      platformUserId: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      profileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      followersCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      accessToken: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      tokenExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      lastSyncedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex(
      "CreatorSocialAccounts",
      ["creatorId", "platform"],
      {
        unique: true,
        name: "uniq_creator_platform",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CreatorSocialAccounts");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CreatorSocialAccounts_platform";',
    );
  },
};
