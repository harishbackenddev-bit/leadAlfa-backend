const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const crypto = require("crypto");
const {
  USER_FEEDBACK_TYPES,
  USER_FEEDBACK_STATUSES,
} = require("../config/userFeedbackConstants");

const UserFeedback = sequelize.define(
  "UserFeedback",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    publicId: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    type: {
      type: DataTypes.ENUM(...Object.values(USER_FEEDBACK_TYPES)),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...USER_FEEDBACK_STATUSES),
      allowNull: false,
      defaultValue: "new",
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "UserFeedbacks",
    timestamps: true,
    indexes: [
      {
        fields: ["publicId"],
        unique: true,
        name: "idx_userFeedbacks_publicId",
      },
      {
        fields: ["userId", "createdAt"],
        name: "idx_userFeedbacks_userId_createdAt",
      },
      {
        fields: ["status", "createdAt"],
        name: "idx_userFeedbacks_status_createdAt",
      },
      {
        fields: ["type", "createdAt"],
        name: "idx_userFeedbacks_type_createdAt",
      },
    ],
  }
);

UserFeedback.beforeValidate((feedback) => {
  if (!feedback.publicId) {
    feedback.publicId = `FBK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

UserFeedback.associate = (models) => {
  UserFeedback.belongsTo(models.User, {
    foreignKey: "userId",
    as: "userAccount",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  UserFeedback.belongsTo(models.User, {
    foreignKey: "resolvedBy",
    as: "resolver",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = UserFeedback;
