const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BankChangeRequest = sequelize.define("BankChangeRequest", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  // ========== USER IDENTIFICATION (email-based) ==========
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: { isEmail: true },
    comment: 'Email of the user requesting the change',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,       // 🔥 optional — email से lookup होगा
    comment: 'Optional user reference (resolved from email)',
  },

  // ========== TRADESAFE IDs (snapshot) ==========
  tradeSafeUserId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tradeSafeTokenId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tradeSafeReference: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // ========== REQUEST DETAILS ==========
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // ========== STATUS ==========
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
    defaultValue: 'PENDING',
    allowNull: false,
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Admin user id who reviewed',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // ========== AVS (TradeSafe re-verification) ==========
  avsStatus: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'FAILED', 'SKIPPED'),
    defaultValue: 'PENDING',
    allowNull: false,
  },
  avsVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // ========== AUDIT ==========
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'BankChangeRequests',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['status'] },
    { fields: ['email', 'status'], name: 'idx_bank_change_email_status' },
    { fields: ['createdAt'] },
  ],
});

// ========== INSTANCE METHODS ==========
BankChangeRequest.prototype.isPending = function () {
  return this.status === 'PENDING';
};

BankChangeRequest.prototype.canReview = function () {
  return this.status === 'PENDING';
};

// ========== CLASS METHODS ==========
BankChangeRequest.findPendingByEmail = async function (email) {
  return this.findOne({
    where: { email, status: 'PENDING' },
  });
};

BankChangeRequest.getByEmail = async function (email) {
  return this.findAll({
    where: { email },
    order: [['createdAt', 'DESC']],
  });
};

module.exports = BankChangeRequest;