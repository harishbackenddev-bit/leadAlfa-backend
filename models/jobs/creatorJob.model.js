const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const CreatorJob = sequelize.define(
  "CreatorJob",
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

    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "CampaignApplications", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment:
        "Nullable: set for hiringSource='campaign_application', null for 'direct_invitation'.",
    },

    hiringSource: {
      type: DataTypes.ENUM("campaign_application", "direct_invitation"),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "ongoing",
        "submitted",
        "approved",
        "completed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "ongoing",
    },

    agreedBudget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment:
        "Cash budget agreed at hire time. Null for Gift-compensation campaigns.",
    },

    deadlineAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        "Per-job submission deadline. Used by UI to render 'due in X days' / 'overdue'. Nullable until work-submission flow ships.",
    },
  },
  {
    tableName: "CreatorJobs",
    timestamps: true,
    indexes: [
      { fields: ["publicId"], unique: true, name: "idx_creatorJob_publicId" },
      {
        fields: ["campaignId", "creatorId"],
        unique: true,
        name: "unique_creator_job_campaign_creator",
      },
      { fields: ["creatorId"], name: "idx_creatorJob_creatorId" },
      { fields: ["campaignId"], name: "idx_creatorJob_campaignId" },
      { fields: ["status"], name: "idx_creatorJob_status" },
      { fields: ["applicationId"], name: "idx_creatorJob_applicationId" },
    ],
  }
);

CreatorJob.beforeValidate((job) => {
  if (!job.publicId) {
    job.publicId = `JOB-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

CreatorJob.associate = (models) => {
  CreatorJob.belongsTo(models.Campaign, {
    foreignKey: "campaignId",
    as: "campaign",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CreatorJob.belongsTo(models.CreatorProfile, {
    foreignKey: "creatorId",
    as: "creator",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CreatorJob.belongsTo(models.CampaignApplication, {
    foreignKey: "applicationId",
    as: "application",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = CreatorJob;
