'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ============================================================
    // Campaigns — funding fields
    // ============================================================
    await queryInterface.addColumn('Campaigns', 'fundingStatus', {
      type: Sequelize.ENUM('UNFUNDED', 'AWAITING_FUNDING', 'FUNDS_RECEIVED', 'FUNDED', 'REFUNDED'),
      defaultValue: 'UNFUNDED',
      allowNull: false,
    });

    await queryInterface.addColumn('Campaigns', 'campaignBudgetCents', {
      type: Sequelize.BIGINT, defaultValue: 0, allowNull: false,
    });

    await queryInterface.addColumn('Campaigns', 'availableBudgetCents', {
      type: Sequelize.BIGINT, defaultValue: 0, allowNull: false,
    });

    await queryInterface.addColumn('Campaigns', 'reservedBudgetCents', {
      type: Sequelize.BIGINT, defaultValue: 0, allowNull: false,
    });

    await queryInterface.addColumn('Campaigns', 'committedBudgetCents', {
      type: Sequelize.BIGINT, defaultValue: 0, allowNull: false,
    });

    await queryInterface.addColumn('Campaigns', 'tradeSafeWalletTokenId', {
      type: Sequelize.STRING, allowNull: true,
    });

    await queryInterface.addColumn('Campaigns', 'fundedAt', {
      type: Sequelize.DATE, allowNull: true,
    });

    // ============================================================
    // FundingBatches — type column
    // ============================================================
    await queryInterface.addColumn('FundingBatches', 'type', {
      type: Sequelize.ENUM('CAMPAIGN_FUNDING', 'CREATOR_ESCROW'),
      defaultValue: 'CAMPAIGN_FUNDING',
      allowNull: false,
    });

    // ============================================================
    // Transactions — reservation fields
    // ============================================================
    await queryInterface.addColumn('Transactions', 'reservationStatus', {
      type: Sequelize.ENUM('RESERVED', 'COMMITTED', 'RELEASED', 'REFUNDED'),
      defaultValue: 'RESERVED', allowNull: false,
    });

    await queryInterface.addColumn('Transactions', 'allocatedFromCampaignCents', {
      type: Sequelize.BIGINT, defaultValue: 0, allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Campaigns', 'fundingStatus');
    await queryInterface.removeColumn('Campaigns', 'campaignBudgetCents');
    await queryInterface.removeColumn('Campaigns', 'availableBudgetCents');
    await queryInterface.removeColumn('Campaigns', 'reservedBudgetCents');
    await queryInterface.removeColumn('Campaigns', 'committedBudgetCents');
    await queryInterface.removeColumn('Campaigns', 'tradeSafeWalletTokenId');
    await queryInterface.removeColumn('Campaigns', 'fundedAt');
    await queryInterface.removeColumn('FundingBatches', 'type');
    await queryInterface.removeColumn('Transactions', 'reservationStatus');
    await queryInterface.removeColumn('Transactions', 'allocatedFromCampaignCents');
  },
};