const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const BrandProfile = sequelize.define(
  "BrandProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addressLine2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    businessType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    jobRole: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    brandPrimaryIndustry: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    companyRegistrationNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: {
      type: DataTypes.ENUM("draft", "pending", "approved", "rejected", "clarification_requested"),
      defaultValue: "pending",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clarificationRequested: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: "BrandProfiles",
    indexes: [
      {
        name: "idx_brand_companyEmail",
        fields: ["companyEmail"],
        unique: true,
      },
      { name: "idx_brand_country", fields: ["country"] },
      { name: "idx_brand_userId", fields: ["userId"], unique: true },
      { name: "idx_brand_status", fields: ["status"] },
    ],
  }
);

BrandProfile.associate = (models) => {
  BrandProfile.hasMany(models.BrandMedia, {
    foreignKey: "brandId",
    as: "mediaLinks",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  BrandProfile.belongsTo(models.User, {
    foreignKey: "userId",
    as: "userAccount",
    onDelete: "CASCADE",
  });

  BrandProfile.belongsTo(models.User, {
    foreignKey: "reviewedBy",
    as: "reviewer",
    onDelete: "SET NULL",
  });
};

module.exports = BrandProfile;
