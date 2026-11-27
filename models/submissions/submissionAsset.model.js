const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const SubmissionAsset = sequelize.define(
  "SubmissionAsset",
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

    revisionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "SubmissionRevisions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Media", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      comment:
        "RESTRICT prevents deletion of Media records that are still referenced by a submission asset.",
    },

    usageType: {
      type: DataTypes.ENUM("final_video", "raw_video", "image"),
      allowNull: false,
      comment:
        "final_video — edited final content; raw_video — unedited raw footage; image — still images.",
    },

    assetName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Auto-populated from Media.name (original filename) at creation.",
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Optional ordering of assets within the same usageType.",
    },

    reviewStatus: {
      type: DataTypes.ENUM("approved", "revision_requested", "rejected"),
      allowNull: true,
      defaultValue: null,
      comment:
        "Informational indicator set by the brand during revision review. " +
        "NULL = not annotated. Does NOT create an independent asset lifecycle.",
    },

    assetFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment:
        "Brand's specific comment on this individual asset. Max 500 chars enforced at service layer.",
    },
  },
  {
    tableName: "SubmissionAssets",
    timestamps: true,
    indexes: [
      {
        fields: ["publicId"],
        unique: true,
        name: "idx_submissionAsset_publicId",
      },
      { fields: ["revisionId"], name: "idx_submissionAsset_revisionId" },
      { fields: ["mediaId"], name: "idx_submissionAsset_mediaId" },
      { fields: ["usageType"], name: "idx_submissionAsset_usageType" },
      { fields: ["reviewStatus"], name: "idx_submissionAsset_reviewStatus" },
    ],
  }
);

SubmissionAsset.beforeValidate((asset) => {
  if (!asset.publicId) {
    asset.publicId = `AST-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

SubmissionAsset.associate = (models) => {
  SubmissionAsset.belongsTo(models.SubmissionRevision, {
    foreignKey: "revisionId",
    as: "revision",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  SubmissionAsset.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
};

module.exports = SubmissionAsset;
