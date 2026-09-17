const { getChatRoomsForUser } = require("../services/chatRoomService");
const { getMessages, setMessagesRead } = require("../services/messageService");
const { uploadChatMessageMedia } = require("../services/mediaService");
const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

const listUserChatRooms = async (req, res) => {
  try {
    const rooms = await getChatRoomsForUser(req.chatContext);
    return res.status(200).json({ success: true, rooms });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error listing user chat rooms", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const getChatRoomMessages = async (req, res) => {
  try {
    const errors = validationResult(req).formatWith(({ msg, path }) => {
      return { field: path, message: msg };
    });
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);

    const data = await getMessages(req.chatRoom, req.chatContext, {
      page,
      limit,
    });
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error getting chat room messages:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const markMessageRead = async (req, res) => {
  try {
    const errors = validationResult(req).formatWith(({ msg, path }) => {
      return { field: path, message: msg };
    });
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lastMessageId } = req.body;
    const userId = req.user.id;
    const chatRoomId = req.chatRoom.id;

    if (!lastMessageId) {
      return res.json({ success: true, message: "No messages to mark read." });
    }

    const count = await setMessagesRead(chatRoomId, lastMessageId, userId,req.chatContext);
    return res.json({ success: true, countMarkedRead: count });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Mark message read error:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const { buildUrl } = require("../utils/mediaDelivery");

const uploadChatMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const userId = req.user.id;

    const mediaItems = await uploadChatMessageMedia(userId, req.files);

    return res.status(201).json({
      success: true,
      media: mediaItems.map((m) => ({
        id: m.id,
        url: buildUrl(m),
        type: m.type,
        name: m.name,
      })),
    });
  } catch (err) {
    console.error("Chat media upload error:", err);
    return res.status(500).json({ error: "Failed to upload chat media." });
  }
};

module.exports = {
  listUserChatRooms,
  getChatRoomMessages,
  markMessageRead,
  uploadChatMedia,
};
