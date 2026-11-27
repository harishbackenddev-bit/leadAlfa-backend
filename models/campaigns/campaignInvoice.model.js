const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const CampaignInvoice = sequelize.define(
  "CampaignInvoice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    publicId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "Campaigns", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    videoLength: {
      type: DataTypes.ENUM("15sec", "30sec", "60sec"),
      allowNull: false,
    },

    numberOfCreators: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    appliedAddOns: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Snapshot of add-on keys used e.g. ['raw_footage','extra_hooks']",
    },

    basePackagePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Per-creator price for the chosen video length package",
    },

    basePackageTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "basePackagePrice × numberOfCreators",
    },

    addOnsPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Combined add-on percentage as a whole integer (e.g. 55 means 55%)",
    },

    addOnsAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: "basePackageTotal × (addOnsPercentage / 100), rounded to 2dp",
    },

    cartSubtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "basePackageTotal + addOnsAmount. Exposed to creators as campaign budget.",
    },

    serviceFeeAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "cartSubtotal × 0.05 (platform 5% fee — not visible to creators)",
    },

    amountBeforeTax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "cartSubtotal + serviceFeeAmount",
    },

    vatAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "amountBeforeTax × 0.15 (SARS VAT 15%)",
    },

    totalAmountDue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "amountBeforeTax + vatAmount — the amount charged to the brand",
    },

    paymentStatus: {
      type: DataTypes.ENUM("unpaid", "pending", "paid", "failed"),
      allowNull: false,
      defaultValue: "unpaid",
      comment: "unpaid→pending (lockInvoice)→paid|failed (webhook). Drives edit-lock on campaign.",
    },

    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    gatewayReference: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "TradeSafe transaction reference. Set by lockInvoice(); used for webhook lookup.",
    },

    gatewayPayload: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Raw TradeSafe webhook response body stored for audit.",
    },
  },
  {
    tableName: "CampaignInvoices",
    timestamps: true,
    indexes: [
      { fields: ["publicId"],         unique: true, name: "idx_invoice_publicId" },
      { fields: ["campaignId"],        unique: true, name: "idx_invoice_campaignId" },
      { fields: ["paymentStatus"],               name: "idx_invoice_paymentStatus" },
      { fields: ["gatewayReference"],            name: "idx_invoice_gatewayReference" },
    ],
  }
);

CampaignInvoice.beforeValidate((invoice) => {
  if (!invoice.publicId) {
    invoice.publicId = `INV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

CampaignInvoice.associate = (models) => {
  CampaignInvoice.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignInvoice;
