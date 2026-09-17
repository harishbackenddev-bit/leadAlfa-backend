const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const crypto = require("crypto");
const { CONTACT_STATUSES } = require("../config/contactConstants");

const ContactRequest = sequelize.define(
  "ContactRequest",
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
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    inquiryType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...CONTACT_STATUSES),
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
    tableName: "ContactRequests",
    timestamps: true,
    indexes: [
      {
        fields: ["publicId"],
        unique: true,
        name: "idx_contactRequests_publicId",
      },
      {
        fields: ["status", "createdAt"],
        name: "idx_contactRequests_status_createdAt",
      },
      {
        fields: ["inquiryType"],
        name: "idx_contactRequests_inquiryType",
      },
    ],
  }
);

ContactRequest.beforeValidate((request) => {
  if (!request.publicId) {
    request.publicId = `REQ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

ContactRequest.associate = (models) => {
  ContactRequest.belongsTo(models.User, {
    foreignKey: "userId",
    as: "userAccount",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  ContactRequest.belongsTo(models.User, {
    foreignKey: "resolvedBy",
    as: "resolver",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
};

module.exports = ContactRequest;
