const ChatRoom = require("../models/chat/chatRoom.model");
const Campaign = require("../models/campaigns/campaign.model");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const Media = require("../models/media/media.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const {getUnread} = require("../utils/redisUtil");

const {
  CREATOR_MEDIA_TYPES,
  BRAND_MEDIA_TYPES,
} = require("../config/mediaUsageTypes");
const AppError = require("../utils/appError");

const findOrCreateCampaignChatRoom = async (
  brandId,
  creatorId,
  campaignId,
  { transaction } = {}
) => {
  if (!brandId || !creatorId || !campaignId) {
    throw new AppError(
      "Brand ID, Creator ID, and Campaign ID are required to create a chat room.",
      400
    );
  }

  const where = { brandId, creatorId, campaignId };
  let room = await ChatRoom.findOne({ where, transaction });
  if (room) return room;

  room = await ChatRoom.create({ brandId, creatorId, campaignId }, { transaction });
  return room;
};

const getChatRoomsForUser = async (chatContext) => {
  const { role, profileId } = chatContext;

  const searchKey = role === "brand" ? "brandId" : "creatorId";

  const otherParticipantInclude =
    role === "brand"
      ? {
          model: CreatorProfile,
          as: "creator",
          include: [
            {
              model: CreatorMedia,
              as: "mediaLinks",
              where: { usageType: CREATOR_MEDIA_TYPES.PROFILE_PHOTO },
              required: false,
              include: [{ model: Media, as: "mediaDetails" }],
            },
          ],
        }
      : {
          model: BrandProfile,
          as: "brand",
          include: [
            {
              model: BrandMedia,
              as: "mediaLinks",
              where: { usageType: BRAND_MEDIA_TYPES.LOGO },
              required: false,
              include: [{ model: Media, as: "mediaDetails" }],
            },
          ],
        };

  const rooms = await ChatRoom.findAll({
    where: { [searchKey]: profileId },
    order: [["updatedAt", "DESC"]],
    include: [
      otherParticipantInclude,
      {
        model: Campaign,
        as: "campaign",
        attributes: ["id", "campaignTitle", "status"],
      },
    ],
  });
  const roomsWithUnread = await Promise.all(
    rooms.map(async (room) => {
      const roomData = room.get({ plain: true });

      try{
        const unreadData = await getUnread(room.id);
        const myKey = `${role}_${profileId}`;

        roomData.unreadCount = unreadData && unreadData[myKey] ? parseInt(unreadData[myKey], 10) : 0;
      }
      catch(redisErr)
      {
        console.error(`Failed to fetch unread for room ${room.id}:`, redisErr);
        roomData.unreadCount = 0;
      }

      return roomData;
    })
  );

  return roomsWithUnread;
};

module.exports = {
  findOrCreateCampaignChatRoom,
  getChatRoomsForUser,
};
