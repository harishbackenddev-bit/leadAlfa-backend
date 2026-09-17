"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ChatRooms", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      brandId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "BrandProfiles", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "CreatorProfiles", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Campaigns", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex(
      "ChatRooms",
      ["brandId", "creatorId", "campaignId"],
      { unique: true, name: "idx_unique_chatroom_pair" }
    );
    await queryInterface.addIndex("ChatRooms", ["brandId"], {
      name: "idx_chatroom_brandId",
    });
    await queryInterface.addIndex("ChatRooms", ["creatorId"], {
      name: "idx_chatroom_creatorId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ChatRooms');
  },
};
