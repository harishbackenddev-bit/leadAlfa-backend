const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CampaignMedia = sequelize.define(
  "CampaignMedia",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usageType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "CampaignMedia",
    timestamps: true,
    indexes: [
      { fields: ["campaignId"], name: "idx_campaignMedia_campaignId" },
      { fields: ["mediaId"], name: "idx_campaignMedia_mediaId" },
    ],
  }
);

CampaignMedia.associate = (models) => {
  CampaignMedia.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CampaignMedia.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignMedia;
