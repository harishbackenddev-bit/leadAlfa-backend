const ChatRoom = require("../models/chat/chatRoom.model");
const AppError = require("../utils/appError");

const validateRoomAccess = async (chatRoomId, profileId, role) => {
  const chatRoom = await ChatRoom.findByPk(chatRoomId);

  if (!chatRoom) {
    throw new AppError("Chat room not found", 404);
  }

  const isParticipant =
    (role === "brand" && chatRoom.brandId === profileId) ||
    (role === "creator" && chatRoom.creatorId === profileId);

  if (!isParticipant) {
    throw new AppError("Unauthorized to access this chat room", 403);
  }

  return chatRoom;
};

module.exports = { validateRoomAccess };
