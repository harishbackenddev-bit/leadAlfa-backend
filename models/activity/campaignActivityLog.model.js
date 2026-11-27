const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const { REVIEW_WINDOW_DAYS } = require("../../config/submissionConstants");

const CampaignActivityLog = sequelize.define(
  "CampaignActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Campaigns", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    actorType: {
      type: DataTypes.ENUM("creator", "brand", "system"),
      allowNull: false,
    },

    actorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "The creatorId or brandId of the actor. Null when actorType is 'system'.",
    },

    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment:
        "Constant string identifying the event — see ACTIVITY_EVENT_TYPES in submissionConstants.js.",
    },

    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "Contextual data for the event, e.g. { revisionPublicId, revisionNumber, feedbackSnippet, reminderMessage }.",
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Set to createdAt + 30 days at insert time.",
    },
  },
  {
    tableName: "CampaignActivityLogs",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["campaignId"], name: "idx_activityLog_campaignId" },
      { fields: ["expiresAt"], name: "idx_activityLog_expiresAt" },
      { fields: ["eventType"], name: "idx_activityLog_eventType" },
      { fields: ["actorType"], name: "idx_activityLog_actorType" },
    ],
  }
);

CampaignActivityLog.associate = (models) => {
  CampaignActivityLog.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CampaignActivityLog;
