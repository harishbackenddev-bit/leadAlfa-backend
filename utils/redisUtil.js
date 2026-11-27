const { createClient } = require("redis");

const redis = createClient({ url: process.env.REDIS_URL });

redis.on("error", (err) => console.error("Redis Error:", err));
redis.on("connect", () => console.log("Successfully connected to Redis"));

async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
}

module.exports = {
  redis,
  connectRedis,

  setUserOnline: async (userId, socketId) => {
    await redis.sAdd(`user:${userId}:sockets`, socketId);
    await redis.set(`user:${userId}:online`, "1");
  },

  removeUserSocket: async (userId, socketId) => {
    await redis.sRem(`user:${userId}:sockets`, socketId);
    const socketsLeft = await redis.sCard(`user:${userId}:sockets`);
    if (socketsLeft === 0) {
      await redis.del(`user:${userId}:online`);
    }
  },

  isUserOnline: async (userId) => {
    return await redis.exists(`user:${userId}:online`);
  },

  incrementUnread: async (chatRoomId, receiverKey) => {
   await redis.hIncrBy(`chat:${chatRoomId}:unread`, receiverKey, 1); 
  },

  resetUnread: async (chatRoomId, fieldKey) => {
    await redis.hSet(`chat:${chatRoomId}:unread`, fieldKey, 0);
  },

  getUnread: async (chatRoomId) => {
    return await redis.hGetAll(`chat:${chatRoomId}:unread`);
  },

  setUploadSession: async (userId, s3Key, sessionData, ttlSeconds = 300) => {
    await connectRedis();
    await redis.set(`upload:session:${userId}:${s3Key}`, JSON.stringify(sessionData), {
      EX: ttlSeconds,
    });
  },

  getUploadSession: async (userId, s3Key) => {
    await connectRedis();
    const data = await redis.get(`upload:session:${userId}:${s3Key}`);
    return data ? JSON.parse(data) : null;
  },

  deleteUploadSession: async (userId, s3Key) => {
    await connectRedis();
    await redis.del(`upload:session:${userId}:${s3Key}`);
  },
};
