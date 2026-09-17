"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ContactRequests", {
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
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      inquiryType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex("ContactRequests", ["publicId"], {
      unique: true,
      name: "idx_contactRequests_publicId",
    });

    await queryInterface.addIndex("ContactRequests", ["status", "createdAt"], {
      name: "idx_contactRequests_status_createdAt",
    });

    await queryInterface.addIndex("ContactRequests", ["inquiryType"], {
      name: "idx_contactRequests_inquiryType",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ContactRequests");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ContactRequests_status";'
    );
  },
};
