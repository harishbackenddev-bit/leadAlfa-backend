const { sequelize } = require("../config/database");
const Message = require("../models/chat/message.model");
const Media = require("../models/media/media.model");
const MessageReadStatus = require("../models/chat/messageReadStatus.model");
const ChatMessageMedia = require("../models/chat/chatMessageMedia.model");
const { getBrandUserId } = require("../services/brandProfileService");
const { getCreatorUserId } = require("../services/creatorProfileService");
const { Op } = require("sequelize");
const { resetUnread } = require("../utils/redisUtil");

const getMessages = async (
  chatRoom,
  chatContext,
  { page = 1, limit = 50 } = {}
) => {
  const offset = (page - 1) * limit;

  const isBrand = chatContext.role === "brand";
  const otherRole = isBrand ? "creator" : "brand";

  const otherParticipantUserId =
    otherRole === "brand"
      ? await getBrandUserId(chatRoom.brandId)
      : await getCreatorUserId(chatRoom.creatorId);

  const { rows, count } = await Message.findAndCountAll({
    where: { chatRoomId: chatRoom.id },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Media,
        as: "media",
        required: false,
      },
      {
        model: MessageReadStatus,
        as: "readBy",
        required: false,
        where: { readerUserId: otherParticipantUserId },
      },
    ],
    distinct: true,
  });

  return {
    messages: rows.reverse(),
    total: count,
    page,
    limit,
  };
};

const setMessagesRead = async (
  chatRoomId,
  lastMessageId,
  readingUserId,
  chatContext
) => {
  const { role, profileId } = chatContext;
  const unreadMessages = await Message.findAll({
    attributes: ["id"],
    where: {
      chatRoomId,
      id: { [Op.lte]: lastMessageId },
      senderUserId: { [Op.ne]: readingUserId },
    },
    include: [
      {
        model: MessageReadStatus,
        as: "readBy",
        required: false,
        where: { readerUserId: readingUserId },
      },
    ],
  });

  const messagesToMark = unreadMessages
    .filter((msg) => !msg.readStatus || msg.readStatus.length === 0)
    .map((msg) => ({
      messageId: msg.id,
      readerUserId: readingUserId,
      readAt: new Date(),
    }));

  if (messagesToMark.length > 0) {
    await MessageReadStatus.bulkCreate(messagesToMark, {
      ignoreDuplicates: true,
    });
  }

  const fieldKey = `${role}_${profileId}`;
  await resetUnread(chatRoomId, fieldKey);

  return messagesToMark.length;
};

const saveMessage = async (
  chatRoomId,
  senderId,
  messageText,
  mediaIds = []
) => {
  const result = await sequelize.transaction(async (t) => {
    const newMessage = await Message.create(
      {
        chatRoomId,
        senderUserId: senderId,
        message: messageText,
      },
      { transaction: t }
    );

    if (mediaIds && mediaIds.length > 0) {
      const mediaLinks = mediaIds.map((id) => ({
        messageId: newMessage.id,
        mediaId: id,
        usageType: "attachment",
      }));

      await ChatMessageMedia.bulkCreate(mediaLinks, { transaction: t });
    }

    return await Message.findByPk(newMessage.id, {
      include: [
        {
          model: Media,
          as: "media",
        },
      ],
      transaction: t,
    });
  });

  return result;
};

module.exports = {
  getMessages,
  setMessagesRead,
  saveMessage,
};
