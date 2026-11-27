const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const ShippingAddress = sequelize.define(
  "ShippingAddress",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ownerType: {
      type: DataTypes.ENUM("brand", "creator"),
      allowNull: false,
    },
    ownerId: { type: DataTypes.INTEGER, allowNull: false },

    streetAddress: { type: DataTypes.STRING, allowNull: false },
    localArea: { type: DataTypes.STRING, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: false },
    zone: { type: DataTypes.STRING, allowNull: false },
    country: { type: DataTypes.STRING, allowNull: false, defaultValue: "South Africa" },
    postalCode: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: true },

    contactName: { type: DataTypes.STRING, allowNull: false },
    contactEmail: { type: DataTypes.STRING, allowNull: true },
    contactMobile: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: "ShippingAddresses",
    timestamps: true,
    indexes: [{ unique: true, fields: ["ownerType", "ownerId"] }],
  }
);

module.exports = ShippingAddress;
