"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Media", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("image", "video", "document", "other"),
        allowNull: false,
      },
      provider: { type: Sequelize.STRING, allowNull: false },
      public_id: { type: Sequelize.STRING, allowNull: true },
      uploadedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("Media", ["type"]);
    await queryInterface.addIndex("Media", ["uploadedBy"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Media");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Media_type";'
    );
  },
};
