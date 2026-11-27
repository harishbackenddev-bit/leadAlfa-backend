const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Campaigns',
      key: 'id',
    },
  },
  brandUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  creatorUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },


  fundingBatchId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'FundingBatches',
      key: 'id',
    },
  },


  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  amountCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },


  commissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  commissionCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },


  brandServiceFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  brandServiceFeeCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  // Creatrend Combined (Commission + Brand Fee)
  creatrendCombinedAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  creatrendCombinedCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },


  brandContributionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  brandContributionCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },


  creatorNetAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  creatorNetCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  // Platform Fee (TradeSafe fee - old, keeping for compatibility)
  platformFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  platformFeeCents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

 
  reservationStatus: {
    type: DataTypes.ENUM('RESERVED', 'COMMITTED', 'RELEASED', 'REFUNDED'),
    defaultValue: 'RESERVED',
    allowNull: false,
    comment: "Tracks campaign budget lifecycle: RESERVED → COMMITTED → RELEASED/REFUNDED.",
  },
  allocatedFromCampaignCents: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    allowNull: false,
    comment: "Amount reserved/committed from the parent campaign budget for this creator.",
  },

 
  tradesafeTransactionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tradesafeAllocationId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  checkoutLink: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

 
  tradesafeFundingStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tradesafeReleaseStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },

 
  fundedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  fundingError: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fundingAttemptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

 
  status: {
    type: DataTypes.ENUM(
      'CREATED',
      'PENDING_PAYMENT',
      'FUNDING_IN_PROGRESS',
      'FUNDING_FAILED',
      'FUNDED',
      'IN_PROGRESS',
      'DELIVERED',
      'UNDER_REVIEW',
      'REVISION_REQUESTED',
      'APPROVED',
      'PAYOUT_TRIGGERED',
      'RELEASED',
      'COMPLETED',
      'DISPUTED',
      'REFUNDED',
      'CANCELLED'
    ),
    defaultValue: 'CREATED',
  },

  // ========== TIMESTAMPS ==========
  lockedAt: { type: DataTypes.DATE, allowNull: true },
  releasedAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  refundedAt: { type: DataTypes.DATE, allowNull: true },
  deliveryStartedAt: { type: DataTypes.DATE, allowNull: true },
  deliveredAt: { type: DataTypes.DATE, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },


  reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  campaignCreatorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },


  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
  },

 
  lastWebhookReceived: { type: DataTypes.DATE, allowNull: true },
  lastWebhookPayload: { type: DataTypes.JSON, allowNull: true },
  retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },

}, {
  timestamps: true,
  tableName: 'Transactions',
  indexes: [
    { fields: ['campaignId'] },
    { fields: ['brandUserId'] },
    { fields: ['creatorUserId'] },
    { fields: ['tradesafeTransactionId'] },
    { fields: ['status'] },
    { fields: ['reference'] },
    { fields: ['campaignId', 'creatorUserId'] },
    { fields: ['fundingBatchId'] },
    { fields: ['reservationStatus'], name: 'idx_transactions_reservationStatus' },
    { fields: ['campaignId', 'reservationStatus'], name: 'idx_transactions_campaign_reservation' },
  ],
});


Transaction.associate = (models) => {
  Transaction.belongsTo(models.Campaign, {
    foreignKey: 'campaignId',
    as: 'campaign',
  });

  Transaction.belongsTo(models.User, {
    foreignKey: 'brandUserId',
    as: 'brand',
  });

  Transaction.belongsTo(models.User, {
    foreignKey: 'creatorUserId',
    as: 'creator',
  });

  Transaction.belongsTo(models.FundingBatch, {
    foreignKey: 'fundingBatchId',
    as: 'fundingBatch',
  });
};


Transaction.prototype.getAmountInRands = function() {
  return (this.amountCents / 100).toFixed(2);
};

Transaction.prototype.getCreatorNetInRands = function() {
  return (this.creatorNetCents / 100).toFixed(2);
};

Transaction.prototype.getCommissionInRands = function() {
  return (this.commissionCents / 100).toFixed(2);
};

Transaction.prototype.getBrandServiceFeeInRands = function() {
  return (this.brandServiceFeeCents / 100).toFixed(2);
};

Transaction.prototype.getCreatrendCombinedInRands = function() {
  return (this.creatrendCombinedCents / 100).toFixed(2);
};

Transaction.prototype.getBrandContributionInRands = function() {
  return (this.brandContributionCents / 100).toFixed(2);
};


Transaction.prototype.isFunded = function() {
  return ['FUNDED', 'FUNDING_IN_PROGRESS', 'IN_PROGRESS', 'DELIVERED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'PAYOUT_TRIGGERED', 'RELEASED', 'COMPLETED'].includes(this.status);
};

Transaction.prototype.isCompleted = function() {
  return ['COMPLETED', 'RELEASED'].includes(this.status);
};

Transaction.prototype.isPending = function() {
  return ['CREATED', 'PENDING_PAYMENT'].includes(this.status);
};

Transaction.prototype.isFailed = function() {
  return ['FUNDING_FAILED'].includes(this.status);
};

Transaction.prototype.isActive = function() {
  return ['FUNDED', 'FUNDING_IN_PROGRESS', 'IN_PROGRESS', 'DELIVERED', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(this.status);
};

Transaction.prototype.canRelease = function() {
  return ['FUNDED', 'APPROVED'].includes(this.status);
};


Transaction.getByTradeSafeId = async function(tradesafeTransactionId) {
  return this.findOne({ where: { tradesafeTransactionId } });
};

Transaction.getByCampaign = async function(campaignId) {
  return this.findAll({ where: { campaignId } });
};

Transaction.getByCreator = async function(creatorUserId) {
  return this.findAll({ where: { creatorUserId } });
};

Transaction.getByBrand = async function(brandUserId) {
  return this.findAll({ where: { brandUserId } });
};

Transaction.getByFundingBatch = async function(fundingBatchId) {
  return this.findAll({ where: { fundingBatchId } });
};

Transaction.getFailedFunding = async function(campaignId) {
  return this.findAll({
    where: {
      campaignId,
      status: 'FUNDING_FAILED'
    }
  });
};

Transaction.getPendingFunding = async function(campaignId) {
  return this.findAll({
    where: {
      campaignId,
      status: {
        [Op.in]: ['CREATED', 'PENDING_PAYMENT']
      }
    }
  });
};

module.exports = Transaction;