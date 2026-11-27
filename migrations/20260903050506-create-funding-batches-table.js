// migrations/YYYYMMDDHHMMSS-create-funding-batches-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('FundingBatches', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Campaigns',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      brandUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      totalValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      totalValueCents: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      platformFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      platformFeeCents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      brandFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      brandFeeCents: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      creatorSubtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      creatorSubtotalCents: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      tradesafeFundingTransactionId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      checkoutLink: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          'PENDING_PAYMENT',
          'PAYMENT_RECEIVED',
          'PARTIALLY_FUNDED',
          'FULLY_FUNDED',
          'FUNDING_FAILED'
        ),
        defaultValue: 'PENDING_PAYMENT',
      },
      fundedCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      failedCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      fundedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Add indexes
    await queryInterface.addIndex('FundingBatches', ['campaignId']);
    await queryInterface.addIndex('FundingBatches', ['brandUserId']);
    await queryInterface.addIndex('FundingBatches', ['reference'], {
      unique: true,
    });
    await queryInterface.addIndex('FundingBatches', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FundingBatches');
  }
};