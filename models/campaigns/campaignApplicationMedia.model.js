const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CampaignApplicationMedia = sequelize.define(
  "CampaignApplicationMedia",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    campaignApplicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "CampaignApplications", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Media", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    usageType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "CampaignApplicationMedia",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["campaignApplicationId", "mediaId", "usageType"],
        name: "unique_application_media_usage",
      },
      { fields: ["campaignApplicationId"], name: "idx_appMedia_applicationId" },
      { fields: ["mediaId"], name: "idx_appMedia_mediaId" },
    ],
  }
);

CampaignApplicationMedia.associate = (models) => {
  CampaignApplicationMedia.belongsTo(models.CampaignApplication, {
    foreignKey: "campaignApplicationId",
    as: "application",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CampaignApplicationMedia.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignApplicationMedia;
