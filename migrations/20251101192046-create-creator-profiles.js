"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CreatorProfiles", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      addressLine1: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      addressLine2: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      postalZipCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ethnicity: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      appearance: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      languages: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: "List of languages (e.g., ['English', 'Hindi', 'French'])",
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: Sequelize.ENUM("draft", "pending", "approved", "rejected"),
        defaultValue: "draft",
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

    await queryInterface.addIndex("CreatorProfiles", ["email"], {
      name: "idx_creator_email",
      unique: true,
    });

    await queryInterface.addIndex("CreatorProfiles", ["country"], {
      name: "idx_creator_country",
    });

    await queryInterface.addIndex("CreatorProfiles", ["userId"], {
      name: "idx_creator_userId",
      unique: true,
    });

    await queryInterface.addIndex("CreatorProfiles", ["status"], {
      name: "idx_creator_status",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CreatorProfiles");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CreatorProfiles_status";'
    );    
  },
};
