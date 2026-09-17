const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const SubmissionRevision = sequelize.define(
  "SubmissionRevision",
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

    submissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "WorkSubmissions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    revisionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment:
        "1 = initial submission, 2 = first resubmit after revision, 3 = second resubmit.",
    },

    status: {
      type: DataTypes.ENUM(
        "pending_review",
        "approved",
        "revision_requested",
        "rejected"
      ),
      allowNull: false,
      defaultValue: "pending_review",
      comment:
        "Review status of the entire submission package for this revision round.",
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Creator's general notes for this revision round. Max 500 chars.",
    },

    captionOrHook: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Caption or hook used in the content. Max 200 chars.",
    },

    revisionFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment:
        "Brand's feedback. Populated when status transitions to revision_requested or rejected.",
    },

    reviewDeadline: {
      type: DataTypes.DATE,
      allowNull: false,
      comment:
        "SLA deadline by which brand must review. Set at creation: submittedAt + REVIEW_WINDOW_DAYS.",
    },

    lastReminderSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        "Tracks when creator last sent a reminder. Used to enforce the 24-hour reminder throttle.",
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    submittedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment: "Audit field — User who submitted this revision round.",
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Set when brand approves, requests revision, or rejects.",
    },

    reviewedByBrandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "BrandProfiles", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment: "Audit field — BrandProfile who reviewed this revision.",
    },

    reviewSource: {
      type: DataTypes.ENUM("brand", "system"),
      allowNull: true,
      defaultValue: null,
      comment:
        "Audit field — 'brand' = manually reviewed by a brand user; 'system' = auto-approved by cron on deadline expiry. NULL while still pending_review.",
    },
  },
  {
    tableName: "SubmissionRevisions",
    timestamps: true,
    indexes: [
      {
        fields: ["publicId"],
        unique: true,
        name: "idx_submissionRevision_publicId",
      },
      {
        fields: ["submissionId", "revisionNumber"],
        unique: true,
        name: "unique_submission_revisionNumber",
      },
      { fields: ["submissionId"], name: "idx_submissionRevision_submissionId" },
      { fields: ["status"], name: "idx_submissionRevision_status" },
      {
        fields: ["reviewDeadline"],
        name: "idx_submissionRevision_reviewDeadline",
      },
      {
        fields: ["submittedByUserId"],
        name: "idx_submissionRevision_submittedByUserId",
      },
      {
        fields: ["reviewSource"],
        name: "idx_submissionRevision_reviewSource",
      },
    ],
  }
);

SubmissionRevision.beforeValidate((revision) => {
  if (!revision.publicId) {
    revision.publicId = `REV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

SubmissionRevision.associate = (models) => {
  SubmissionRevision.belongsTo(models.WorkSubmission, {
    foreignKey: "submissionId",
    as: "submission",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  SubmissionRevision.hasMany(models.SubmissionAsset, {
    foreignKey: "revisionId",
    as: "assets",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  SubmissionRevision.belongsTo(models.User, {
    foreignKey: "submittedByUserId",
    as: "submittedBy",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  SubmissionRevision.belongsTo(models.BrandProfile, {
    foreignKey: "reviewedByBrandId",
    as: "reviewedBy",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = SubmissionRevision;
