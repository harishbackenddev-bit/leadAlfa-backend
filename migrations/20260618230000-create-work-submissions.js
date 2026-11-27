"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("WorkSubmissions", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      publicId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      jobId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "CreatorJobs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      totalRevisionRequests: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex("WorkSubmissions", ["publicId"], {
      unique: true,
      name: "idx_workSubmission_publicId",
    });

    await queryInterface.addIndex("WorkSubmissions", ["jobId"], {
      unique: true,
      name: "idx_workSubmission_jobId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("WorkSubmissions");
  },
};
