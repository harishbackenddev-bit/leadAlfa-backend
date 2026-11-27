const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { attachChatContext } = require("../middlewares/attachChatContext");
const {
  chatRoomAuthMiddleware,
} = require("../middlewares/chatRoomAuthMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");
const { validateMediaArray } = require("../utils/mediaValidation");
const router = express.Router();

const {
  listUserChatRooms,
  getChatRoomMessages,
  markMessageRead,
  uploadChatMedia,
} = require("../controllers/chatRoomController");

const chatMediaConfig = {
  maxCount: 10,
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "application/pdf"],
  maxSize: 20 * 1024 * 1024 
};

router.post(
  "/media/upload",
  authenticateJWT,
  uploadLimiter,
  upload.array("files", chatMediaConfig.maxCount),
  validateMediaArray(chatMediaConfig),
  uploadChatMedia
);

router.get("/rooms", authenticateJWT, attachChatContext, listUserChatRooms);

router.get(
  "/room/:chatRoomId/messages",
  authenticateJWT,
  attachChatContext,
  [
    param("chatRoomId").isInt().withMessage("Invalid Chat Room ID"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  chatRoomAuthMiddleware,
  getChatRoomMessages
);

router.post(
  "/read",
  authenticateJWT,
  attachChatContext,
  [
    body("chatRoomId").isInt().withMessage("Chat Room ID must be an integer"),
    body("lastMessageId")
      .isInt()
      .withMessage("Last Message ID must be an integer"),
  ],
  chatRoomAuthMiddleware,
  markMessageRead
);

module.exports = router;
