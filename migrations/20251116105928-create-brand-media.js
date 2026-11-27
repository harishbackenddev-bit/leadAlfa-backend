"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("BrandMedia", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      brandId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "BrandProfiles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      mediaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Media",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      usageType: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex("BrandMedia", ["brandId"]);
    await queryInterface.addIndex("BrandMedia", ["mediaId"]);
    await queryInterface.addIndex("BrandMedia", ["usageType"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("BrandMedia");
  },
};
