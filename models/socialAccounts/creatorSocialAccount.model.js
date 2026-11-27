const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CreatorSocialAccount = sequelize.define(
  "CreatorSocialAccount",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "CreatorProfiles",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    platform: {
      type: DataTypes.ENUM("instagram", "tiktok"),
      allowNull: false,
    },

    platformUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    profileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    followersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "CreatorSocialAccounts",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["creatorId", "platform"],
      },
    ],
  },
);

CreatorSocialAccount.associate = (models) => {
  CreatorSocialAccount.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creator",
  });
};

module.exports = CreatorSocialAccount;
