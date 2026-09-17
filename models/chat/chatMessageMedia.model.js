
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const ChatMessageMedia = sequelize.define(
  "ChatMessageMedia",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Messages", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Media", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    usageType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "attachment",
    },
  },
  {
    tableName: "ChatMessageMedia",
    timestamps: true,
    indexes: [
      { fields: ["messageId"], name: "idx_chatMessageMedia_messageId" },
      { fields: ["mediaId"], name: "idx_chatMessageMedia_mediaId" },
    ],
  }
);

ChatMessageMedia.associate = (models) => {
  ChatMessageMedia.belongsTo(models.Message, {
    foreignKey: "messageId",
    as: "message",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  ChatMessageMedia.belongsTo(models.Media, {
    foreignKey: "mediaId",
    as: "mediaDetails",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = ChatMessageMedia;
