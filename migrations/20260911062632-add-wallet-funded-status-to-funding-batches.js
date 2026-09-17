// migrations/YYYYMMDDHHMMSS-add-wallet-funded-status-to-funding-batches.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add WALLET_FUNDED to existing ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_FundingBatches_status" ADD VALUE IF NOT EXISTS 'WALLET_FUNDED';
    `);

    // Add RELEASE_FAILED if needed
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Transactions_status" ADD VALUE IF NOT EXISTS 'RELEASE_FAILED';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL doesn't support removing enum values
    console.log('⚠️ Cannot remove enum values in PostgreSQL');
  }
};