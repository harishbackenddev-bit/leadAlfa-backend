const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Message = sequelize.define(
  "Message",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    chatRoomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ChatRooms", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    senderUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    message: { type: DataTypes.TEXT, allowNull: true },

    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Media", key: "id" },
    },
  },
  {
    tableName: "Messages",
    timestamps: true,
    indexes: [
      {
        fields: ["chatRoomId", "createdAt"],
        name: "idx_messages_chatRoom_createdAt",
      },
      { fields: ["senderUserId"], name: "idx_messages_senderUserId" },
    ],
  }
);

Message.associate = (models) => {
  Message.belongsTo(models.ChatRoom, {
    foreignKey: "chatRoomId",
    as: "chatRoom",
  });
  Message.belongsTo(models.User, { foreignKey: "senderUserId", as: "sender" });
  Message.belongsTo(models.Media, { foreignKey: "mediaId", as: "media" });
  Message.hasMany(models.MessageReadStatus, {
    foreignKey: "messageId",
    as: "readBy",
  });
};

module.exports = Message;
