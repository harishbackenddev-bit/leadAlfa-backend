const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const MessageReadStatus = sequelize.define(
  "MessageReadStatus",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Messages", key: "id" },
      onDelete: "CASCADE",
    },

    readerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },

    readAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    }
  },
  {
    tableName: "MessageReadStatus",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["messageId", "readerUserId"],
        name: "unique_message_read_pair"
      },
      { fields: ["readerUserId"] },
    ]
  }
);

MessageReadStatus.associate = (models) => {
  MessageReadStatus.belongsTo(models.Message, {
    foreignKey: "messageId",
    as: "message",
  });

  MessageReadStatus.belongsTo(models.User, {
    foreignKey: "readerUserId",
    as: "reader",
  });
};

module.exports = MessageReadStatus;