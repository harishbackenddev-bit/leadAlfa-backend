const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { verifyToken } = require("../utils/jwtUtil");
const { containsDisallowedContent } = require("../utils/messageFilter");

const { saveMessage } = require("../services/messageService");
const { getBrandIdByUser } = require("../services/brandProfileService");
const { getCreatorIdByUser } = require("../services/creatorProfileService");

const { validateRoomAccess } = require("../utils/chatSecurity");

const {
  redis,
  connectRedis,
  setUserOnline,
  removeUserSocket,
  incrementUnread,
  resetUnread,
  getUnread,
} = require("../utils/redisUtil");

const handleSocketError = (socket, err, eventName = "error_message") => {
  console.error(`Socket Error [${eventName}]:`, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected error occurred";

  socket.emit(eventName, {
    statusCode,
    message,
  });
};

async function startSocketServer(appServer) {
  const io = new Server(appServer, {
    cors: {
      origin: "*",
    },
  });

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect(), connectRedis()]);
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.token;
    if (!token)
      return next(new Error("Authentication error: No token provided"));
    try {
      const decoded = verifyToken(token, process.env.JWT_SECRET);
      if (!decoded) return next(new Error("Authentication error"));

      const role = decoded.role;
      let profileId;

      if (role === "brand") {
        profileId = await getBrandIdByUser(decoded.id);
      } else if (role === "creator") {
        profileId = await getCreatorIdByUser(decoded.id);
      }
      socket.user = { ...decoded, profileId };
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.user;
    // console.log("User connected: ", user.id);

    const personalRoom = `private_${user.role}_${user.profileId}`;
    socket.join(personalRoom);

    await setUserOnline(user.id, socket.id);

    socket.broadcast.emit("user_online", { userId: user.id });

    socket.on("join_room", async (payload) => {
      try {
        const { chatRoomId } = payload;
        const { profileId, role } = user;
        const chatRoom = await validateRoomAccess(chatRoomId, profileId, role);

        socket.join(`chat_${chatRoomId}`);
        const myUnreadKey = `${role}_${profileId}`;
        await resetUnread(chatRoomId, myUnreadKey);

        const unread = await getUnread(chatRoomId);
        socket.emit("unread_counts", unread);
      } catch (err) {
        handleSocketError(socket, err, "join_room_error");
      }
    });

    socket.on("send_message", async (payload, ack) => {
      try {
        const { chatRoomId, message, mediaIds } = payload;

        if (containsDisallowedContent(message)) {
          if (ack)
            ack({
              success: false,
              error: "Message contains disallowed content.",
            });
          return;
        }

        const chatRoom = await validateRoomAccess(
          chatRoomId,
          user.profileId,
          user.role
        );

        let receiverKey;

        if (user.role === "brand") {
          receiverKey = `creator_${chatRoom.creatorId}`;
        } else if (user.role === "creator") {
          receiverKey = `brand_${chatRoom.brandId}`;
        }

        const saved = await saveMessage(chatRoomId, user.id, message, mediaIds);
        await incrementUnread(chatRoomId, receiverKey);

        io.to(`chat_${chatRoomId}`).emit("new_message", saved);

        if (ack) ack({ success: true, message: saved });
      } catch (err) {
        console.error("send_message err", err);
        if (ack)
          ack({
            success: false,
            error: err.message || "send failed",
            statusCode: err.statusCode || 500,
          });
      }
    });

    socket.on("typing", ({ chatRoomId }) => {
      socket.to(`chat_${chatRoomId}`).emit("typing", { userId: user.id });
    });

    socket.on("disconnect", async () => {
      // console.log("User disconnected: ", user.id);
      await removeUserSocket(user.id, socket.id);
      const stillOnline = await redis.exists(`user:${user.id}:online`);
      if (!stillOnline) {
        socket.broadcast.emit("user_offline", { userId: user.id });
      }
    });
  });

  return { io, pubClient, subClient };
}

module.exports = { startSocketServer };
