"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("BookCallRequests", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      publicId: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      businessEmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      companyName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      companyWebsite: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("new", "in_progress", "resolved"),
        allowNull: false,
        defaultValue: "new",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
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

    await queryInterface.addIndex("BookCallRequests", ["publicId"], {
      unique: true,
      name: "idx_bookCallRequests_publicId",
    });

    await queryInterface.addIndex("BookCallRequests", ["status", "createdAt"], {
      name: "idx_bookCallRequests_status_createdAt",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("BookCallRequests");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_BookCallRequests_status";'
    );
  },
};
