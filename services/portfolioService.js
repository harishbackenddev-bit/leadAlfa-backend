const Media = require("../models/media/media.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const { CREATOR_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { deleteMediaData } = require("./mediaService");
const { enrichLinkRecord } = require("../utils/mediaDelivery");
const AppError = require("../utils/appError");

const MAX_PORTFOLIO_VIDEOS = 5;


const getPortfolioVideos = async (creatorId) => {
  const records = await CreatorMedia.findAll({
    where: {
      creatorId,
      usageType: CREATOR_MEDIA_TYPES.PORTFOLIO,
    },
    include: [{ model: Media, as: "mediaDetails" }],
    order: [["createdAt", "ASC"], ["id", "ASC"]],
  });

  const portfolioVideos = records.map((record) => enrichLinkRecord(record.toJSON()));

  return {
    portfolioVideos,
    count: portfolioVideos.length,
    maxAllowed: MAX_PORTFOLIO_VIDEOS,
    remaining: Math.max(0, MAX_PORTFOLIO_VIDEOS - portfolioVideos.length),
  };
};


const addPortfolioVideo = async (userId, creatorId, mediaId) => {
  const parsedMediaId = parseInt(mediaId, 10);
  if (!parsedMediaId || isNaN(parsedMediaId) || parsedMediaId <= 0) {
    throw new AppError("Invalid or missing mediaId.", 400);
  }

  const media = await Media.findByPk(parsedMediaId);
  if (!media) {
    throw new AppError("Media not found.", 404);
  }

  if (media.uploadedBy !== userId) {
    throw new AppError("You do not have permission to use this media.", 403);
  }

  if (media.type !== "video") {
    throw new AppError("Only video media can be added as portfolio videos.", 400);
  }

  const existingInPortfolio = await CreatorMedia.findOne({
    where: {
      creatorId,
      mediaId: parsedMediaId,
      usageType: CREATOR_MEDIA_TYPES.PORTFOLIO,
    },
  });
  if (existingInPortfolio) {
    throw new AppError("This video is already in your portfolio.", 409);
  }

  const alreadyLinked = await CreatorMedia.findOne({
    where: { mediaId: parsedMediaId },
  });
  if (alreadyLinked) {
    throw new AppError("This media is already associated with a profile.", 409);
  }

  const currentCount = await CreatorMedia.count({
    where: {
      creatorId,
      usageType: CREATOR_MEDIA_TYPES.PORTFOLIO,
    },
  });

  if (currentCount >= MAX_PORTFOLIO_VIDEOS) {
    throw new AppError(`Maximum portfolio videos (${MAX_PORTFOLIO_VIDEOS}) reached.`, 400);
  }

  const createdLink = await CreatorMedia.create({
    creatorId,
    mediaId: parsedMediaId,
    usageType: CREATOR_MEDIA_TYPES.PORTFOLIO,
  });

  const createdWithMedia = await CreatorMedia.findByPk(createdLink.id, {
    include: [{ model: Media, as: "mediaDetails" }],
  });

  return enrichLinkRecord(createdWithMedia.toJSON());
};


const removePortfolioVideo = async (creatorId, mediaId) => {
  const parsedMediaId = parseInt(mediaId, 10);
  if (!parsedMediaId || isNaN(parsedMediaId) || parsedMediaId <= 0) {
    throw new AppError("Invalid or missing mediaId.", 400);
  }

  const link = await CreatorMedia.findOne({
    where: {
      creatorId,
      mediaId: parsedMediaId,
      usageType: CREATOR_MEDIA_TYPES.PORTFOLIO,
    },
  });

  if (!link) {
    throw new AppError("Portfolio video not found.", 404);
  }

  await CreatorMedia.destroy({ where: { id: link.id } });
  await deleteMediaData([parsedMediaId], null, true);

  return { message: "Portfolio video removed successfully." };
};

module.exports = {
  MAX_PORTFOLIO_VIDEOS,
  getPortfolioVideos,
  addPortfolioVideo,
  removePortfolioVideo,
};
