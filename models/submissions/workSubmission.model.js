const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const WorkSubmission = sequelize.define(
  "WorkSubmission",
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

    jobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "CreatorJobs", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      comment: "One submission per CreatorJob — enforced by unique constraint.",
    },

    totalRevisionRequests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment:
        "Cumulative count of revision requests made by brand. Capped at MAX_REVISIONS (2).",
    },
  },
  {
    tableName: "WorkSubmissions",
    timestamps: true,
    indexes: [
      { fields: ["publicId"], unique: true, name: "idx_workSubmission_publicId" },
      { fields: ["jobId"], unique: true, name: "idx_workSubmission_jobId" },
    ],
  }
);

WorkSubmission.beforeValidate((submission) => {
  if (!submission.publicId) {
    submission.publicId = `SUB-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

WorkSubmission.associate = (models) => {
  WorkSubmission.belongsTo(models.CreatorJob, {
    foreignKey: "jobId",
    as: "job",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  WorkSubmission.hasMany(models.SubmissionRevision, {
    foreignKey: "submissionId",
    as: "revisions",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = WorkSubmission;
