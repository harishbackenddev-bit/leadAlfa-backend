"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ChatMessageMedia", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Messages", 
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
        defaultValue: "attachment",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("ChatMessageMedia", ["messageId"], {
      name: "idx_chatMessageMedia_messageId",
    });
    await queryInterface.addIndex("ChatMessageMedia", ["mediaId"], {
      name: "idx_chatMessageMedia_mediaId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ChatMessageMedia");
  },
};
