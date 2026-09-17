"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MessageReadStatus", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Messages", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      readerUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      readAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex(
      "MessageReadStatus",
      ["messageId", "readerUserId"],
      {
        name: "unique_message_read_pair",
        unique: true,
      }
    );

    await queryInterface.addIndex("MessageReadStatus", ["readerUserId"], {
      name: "idx_messageReadStatus_reader",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("MessageReadStatus");
  },
};
