"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CreatorProfiles", "instagramUrl", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("CreatorProfiles", "tiktokUrl", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("CreatorProfiles", "portfolioUrl", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("CreatorProfiles", "instagramUrl");
    await queryInterface.removeColumn("CreatorProfiles", "tiktokUrl");
    await queryInterface.removeColumn("CreatorProfiles", "portfolioUrl");
  },
};
