const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CreatorCategory = sequelize.define(
  "CreatorCategory",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "CreatorProfiles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Categories",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "CreatorCategories",
    timestamps: true,
    indexes: [
      { name: "idx_creatorCategory_creatorId", fields: ["creatorId"] },
      { name: "idx_creatorCategory_categoryId", fields: ["categoryId"] },
      {
        name: "idx_creatorCategory_unique_pair",
        unique: true,
        fields: ["creatorId", "categoryId"],
      },
    ],
  }
);

CreatorCategory.associate = (models) => {
  CreatorCategory.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creatorProfile",
  });
  CreatorCategory.belongsTo(models.Category, {
    foreignKey: "categoryId",
    as: "category",
  });
};

module.exports = CreatorCategory;
