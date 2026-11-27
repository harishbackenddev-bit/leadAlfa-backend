'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.createTable("CreatorMedia", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Media",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      usageType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment:
          "Describes how the media is used: profile_photo, passport, portfolio, etc.",
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

    await queryInterface.addIndex("CreatorMedia", ["creatorId"]);
    await queryInterface.addIndex("CreatorMedia", ["mediaId"]);
    await queryInterface.addIndex("CreatorMedia", ["usageType"]);
    
  },

  async down (queryInterface, Sequelize) {
   await queryInterface.dropTable("CreatorMedia");
  }
};
