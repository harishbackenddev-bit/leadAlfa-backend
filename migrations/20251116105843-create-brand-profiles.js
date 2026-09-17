"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("BrandProfiles", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      website: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      companyEmail: {
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
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("BrandProfiles", ["companyEmail"], {
      name: "idx_brand_companyEmail",
      unique: true,
    });

    await queryInterface.addIndex("BrandProfiles", ["country"], {
      name: "idx_brand_country",
    });

    await queryInterface.addIndex("BrandProfiles", ["userId"], {
      name: "idx_brand_userId",
      unique: true,
    });

    await queryInterface.addIndex("BrandProfiles", ["status"], {
      name: "idx_brand_status",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("BrandProfiles");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_BrandProfiles_status";'
    );
  },
};
