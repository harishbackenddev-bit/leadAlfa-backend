const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const CampaignApplication = sequelize.define(
  "CampaignApplication",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Campaigns", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "CreatorProfiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    applicationStatus: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending",
    },

    proposedBudget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Retained for future use. Nullable as of campaign invoice flow — pricing is determined by CampaignInvoice, not creator negotiation.",
    },

    pitch: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    invitationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "CampaignInvitations", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "CampaignApplications",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["campaignId", "creatorId"],
        name: "unique_campaign_creator_application",
      },
      { fields: ["campaignId"] },
      { fields: ["creatorId"] },
      { fields: ["applicationStatus"] },
      { fields: ["invitationId"] },
    ],
  }
);

CampaignApplication.associate = (models) => {
  CampaignApplication.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
  });

  CampaignApplication.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creator",
  });

  CampaignApplication.hasMany(models.CampaignApplicationMedia, {
    foreignKey: "campaignApplicationId",
    as: "applicationMedia",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CampaignApplication.belongsTo(models.CampaignInvitation, {
    foreignKey: "invitationId",
    as: "invitation",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignApplication;
