const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const ChatRoom = sequelize.define(
  "ChatRoom",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "BrandProfiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "CreatorProfiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Campaigns", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "ChatRooms",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["brandId", "creatorId", "campaignId"],
        name: "idx_unique_chatroom_pair",
      },
      { fields: ["brandId"], name: "idx_chatroom_brandId" },
      { fields: ["creatorId"], name: "idx_chatroom_creatorId" },
    ],
  }
);

ChatRoom.associate = (models) => {
  ChatRoom.belongsTo(models.BrandProfile, { foreignKey: "brandId", as: "brand" });
  ChatRoom.belongsTo(models.CreatorProfile, { foreignKey: "creatorId", as: "creator" });
  ChatRoom.belongsTo(models.Campaign, { foreignKey: "campaignId", as: "campaign" });
  ChatRoom.hasMany(models.Message, { foreignKey: "chatRoomId", as: "messages" });
};

module.exports = ChatRoom;