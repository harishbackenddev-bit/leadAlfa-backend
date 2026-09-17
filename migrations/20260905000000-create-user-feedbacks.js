"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("UserFeedbacks", {
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
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      type: {
        type: Sequelize.ENUM("bug", "feedback"),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      pageUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("new", "in_progress", "resolved"),
        allowNull: false,
        defaultValue: "new",
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

    await queryInterface.addIndex("UserFeedbacks", ["publicId"], {
      unique: true,
      name: "idx_userFeedbacks_publicId",
    });

    await queryInterface.addIndex("UserFeedbacks", ["userId", "createdAt"], {
      name: "idx_userFeedbacks_userId_createdAt",
    });

    await queryInterface.addIndex("UserFeedbacks", ["status", "createdAt"], {
      name: "idx_userFeedbacks_status_createdAt",
    });

    await queryInterface.addIndex("UserFeedbacks", ["type", "createdAt"], {
      name: "idx_userFeedbacks_type_createdAt",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("UserFeedbacks");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserFeedbacks_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserFeedbacks_type";'
    );
  },
};
