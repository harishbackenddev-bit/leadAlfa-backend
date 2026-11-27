const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const crypto = require("crypto");
const { BOOK_CALL_STATUSES } = require("../config/bookCallConstants");

const BookCallRequest = sequelize.define(
  "BookCallRequest",
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    businessEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    companyName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    companyWebsite: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...BOOK_CALL_STATUSES),
      allowNull: false,
      defaultValue: "new",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
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
    tableName: "BookCallRequests",
    timestamps: true,
    indexes: [
      {
        fields: ["publicId"],
        unique: true,
        name: "idx_bookCallRequests_publicId",
      },
      {
        fields: ["status", "createdAt"],
        name: "idx_bookCallRequests_status_createdAt",
      },
    ],
  }
);

BookCallRequest.beforeValidate((request) => {
  if (!request.publicId) {
    request.publicId = `CALL-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

BookCallRequest.associate = (models) => {
  BookCallRequest.belongsTo(models.User, {
    foreignKey: "userId",
    as: "userAccount",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  BookCallRequest.belongsTo(models.User, {
    foreignKey: "resolvedBy",
    as: "resolver",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = BookCallRequest;
