const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Category = sequelize.define(
  "Category",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    iconUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "URL or path to the category icon",
    },
  },
  {
    tableName: "Categories",
    timestamps: true,
    indexes: [{ name: "idx_category_name", fields: ["name"], unique: true }],
  }
);

Category.associate = (models) => {
  Category.belongsToMany(models.CreatorProfile, {
    through: "CreatorCategories",
    foreignKey: "categoryId",
    otherKey: "creatorId",
    as: "creators",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = Category;
