const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const CampaignInvitation = sequelize.define(
  "CampaignInvitation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    publicId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Campaigns", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "CreatorProfiles", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    customMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("pending", "accepted", "declined"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  {
    tableName: "CampaignInvitations",
    timestamps: true,
    indexes: [
      { fields: ["publicId"], unique: true, name: "idx_campaignInvitation_publicId" },
      {
        fields: ["campaignId", "creatorId"],
        unique: true,
        name: "unique_campaign_creator_invitation",
      },
      { fields: ["creatorId"], name: "idx_campaignInvitation_creatorId" },
      { fields: ["campaignId"], name: "idx_campaignInvitation_campaignId" },
      { fields: ["status"], name: "idx_campaignInvitation_status" },
    ],
  }
);

CampaignInvitation.beforeValidate((invitation) => {
  if (!invitation.publicId) {
    invitation.publicId = `INV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

CampaignInvitation.associate = (models) => {
  CampaignInvitation.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CampaignInvitation.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creator",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CampaignInvitation.hasOne(models.CampaignApplication, {
    foreignKey: "invitationId",
    as: "application",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignInvitation;
