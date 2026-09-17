const ChatRoom = require("../models/chat/chatRoom.model");
const AppError = require("../utils/appError");

const chatRoomAuthMiddleware = async (req, res, next) => {
  try {
    const chatRoomId = req.params.chatRoomId || req.body.chatRoomId;
    const { role, profileId } = req.chatContext;

    const room = await ChatRoom.findByPk(chatRoomId);
    if (!room) throw new AppError("Chat room not found.", 404);

    const isParticipant =
      role === "brand"
        ? room.brandId === profileId
        : room.creatorId === profileId;

    if (!isParticipant) throw new AppError("Access denied to this chat", 403);
    req.chatRoom = room;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { chatRoomAuthMiddleware };
