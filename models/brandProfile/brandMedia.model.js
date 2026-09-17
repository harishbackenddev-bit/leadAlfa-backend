const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const BrandMedia = sequelize.define(
  "BrandMedia",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to BrandProfile",
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to Media ID",
    },
    usageType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Describes purpose of media (e.g. logo, operating attachment)",
    },
  },
  {
    timestamps: true,
    tableName: "BrandMedia",
    indexes: [
      { fields: ["brandId"] },
      { fields: ["mediaId"] },
      { fields: ["usageType"] },
    ],
  }
);

BrandMedia.associate = (models) => {
  BrandMedia.belongsTo(models.BrandProfile, {
    foreignKey: "brandId",
    as: "brand",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  BrandMedia.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = BrandMedia;
