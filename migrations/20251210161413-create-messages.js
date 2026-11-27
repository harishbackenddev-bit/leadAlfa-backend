"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Messages", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      chatRoomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ChatRooms", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      senderUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      message: { type: Sequelize.TEXT, allowNull: true },
      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Media", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("Messages", ["chatRoomId", "createdAt"], {
      name: "idx_messages_chatRoom_createdAt",
    });
    await queryInterface.addIndex("Messages", ["senderUserId"], {
      name: "idx_messages_senderUserId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Messages");
  },
};
