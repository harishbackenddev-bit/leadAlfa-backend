// models/transaction/fundingBatch.model.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const FundingBatch = sequelize.define('FundingBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brandUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('CAMPAIGN_FUNDING', 'CREATOR_ESCROW'),
    defaultValue: 'CAMPAIGN_FUNDING',
    allowNull: false,
  },
  tradesafeWalletTokenId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Brand's TradeSafe token ID used for wallet funding.",
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  totalValueCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  platformFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  platformFeeCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  creatorSubtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  creatorSubtotalCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tradesafeFundingTransactionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  checkoutLink: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      'PENDING_PAYMENT',
      'PAYMENT_RECEIVED',
      'PARTIALLY_FUNDED',
      'FULLY_FUNDED',
      'FUNDING_FAILED',
      'WALLET_FUNDED'
    ),
    defaultValue: 'PENDING_PAYMENT',
  },
  fundedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  failedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fundedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

}, {
  timestamps: true,
  tableName: 'FundingBatches',
});

// ✅ Add associations
FundingBatch.associate = (models) => {
  FundingBatch.hasMany(models.Transaction, {
    foreignKey: 'fundingBatchId',
    as: 'transactions',
  });

  FundingBatch.belongsTo(models.Campaign, {
    foreignKey: 'campaignId',
    as: 'campaign',
  });

  FundingBatch.belongsTo(models.User, {
    foreignKey: 'brandUserId',
    as: 'brand',
  });
};

module.exports = FundingBatch;