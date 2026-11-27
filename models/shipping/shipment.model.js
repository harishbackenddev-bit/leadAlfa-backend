const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Shipment = sequelize.define(
  "Shipment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Campaigns", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "BrandProfiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "CreatorProfiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    productName: { type: DataTypes.STRING, allowNull: false },
    productImage: { type: DataTypes.TEXT, allowNull: true },
    weightKg: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    lengthCm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    widthCm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    heightCm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    courierName: { type: DataTypes.STRING, allowNull: true },
    serviceLevel: { type: DataTypes.STRING, allowNull: true },
    quotedAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    chargeableKg: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    providerSlug: { type: DataTypes.STRING, allowNull: true },
    serviceLevelCode: { type: DataTypes.STRING, allowNull: true },
    bobgoShipmentId: { type: DataTypes.STRING, allowNull: true },
    submissionStatus: { type: DataTypes.STRING, allowNull: true },
    failedReason: { type: DataTypes.TEXT, allowNull: true },
    healthStatus: { type: DataTypes.STRING, allowNull: true },

    chargedAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    chargedWeightKg: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    chargeDelta: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    notificationsSent: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

    paymentReference: { type: DataTypes.STRING, allowNull: true },
    pfPaymentId: { type: DataTypes.STRING, allowNull: true },

    trackingNumber: { type: DataTypes.STRING, allowNull: true },
    trackingUrl: { type: DataTypes.STRING, allowNull: true },

    deliveryAddress: { type: DataTypes.JSONB, allowNull: true },
    collectionAddress: { type: DataTypes.JSONB, allowNull: true },
    events: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

    estimatedCollectionAt: { type: DataTypes.DATE, allowNull: true },
    estimatedDeliveryAt: { type: DataTypes.DATE, allowNull: true },

    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    confirmedReceivedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "Shipments",
    timestamps: true,
  }
);

Shipment.associate = (models) => {
  Shipment.belongsTo(models.Campaign, { foreignKey: "campaignId", as: "campaign" });
  Shipment.belongsTo(models.BrandProfile, { foreignKey: "brandId", as: "brand" });
  Shipment.belongsTo(models.CreatorProfile, { foreignKey: "creatorId", as: "creator" });
};

module.exports = Shipment;
