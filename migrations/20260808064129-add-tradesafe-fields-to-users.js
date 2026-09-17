// migrations/XXXXXXXXXXXXXX-add-tradesafe-fields-to-users.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add TradeSafe columns
    await queryInterface.addColumn('Users', 'tradeSafeUserId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    
    await queryInterface.addColumn('Users', 'tradeSafeReference', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    
    await queryInterface.addColumn('Users', 'tradeSafeStatus', {
      type: Sequelize.ENUM('PENDING', 'VERIFIED', 'FAILED'),
      defaultValue: 'PENDING',
    });
    
    await queryInterface.addColumn('Users', 'kycStatus', {
      type: Sequelize.ENUM('NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'),
      defaultValue: 'NOT_SUBMITTED',
    });
    
    await queryInterface.addColumn('Users', 'bankVerificationStatus', {
      type: Sequelize.ENUM('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'FAILED'),
      defaultValue: 'NOT_SUBMITTED',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'tradeSafeUserId');
    await queryInterface.removeColumn('Users', 'tradeSafeReference');
    await queryInterface.removeColumn('Users', 'tradeSafeStatus');
    await queryInterface.removeColumn('Users', 'kycStatus');
    await queryInterface.removeColumn('Users', 'bankVerificationStatus');
  }
};