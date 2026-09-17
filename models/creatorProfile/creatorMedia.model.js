const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CreatorMedia = sequelize.define(
  "CreatorMedia",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to CreatorProfile ID",
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to Media ID",
    },
    usageType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Describes purpose of media (e.g. profile_photo, passport, portfolio)",
    },
  },
  {
    timestamps: true,
    tableName: "CreatorMedia",
    indexes: [
      { fields: ["creatorId"] },
      { fields: ["mediaId"] },
      { fields: ["usageType"] },
    ],
  }
);

CreatorMedia.associate = (models) => {
  CreatorMedia.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creator",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  CreatorMedia.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CreatorMedia;