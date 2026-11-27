"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("CampaignApplications", "proposedBudget", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("CampaignApplications", "proposedBudget", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });
  },
};
