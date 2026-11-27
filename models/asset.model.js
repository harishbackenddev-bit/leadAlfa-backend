// models/Asset.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Asset = sequelize.define(
  "Asset",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("image", "video", "gif", "other"),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false, // "cloudinary" | "aws"
    },
    public_id: {
      type: DataTypes.STRING,
      allowNull: true, // used for delete
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Asset;
