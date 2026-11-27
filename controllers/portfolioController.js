const {
  getPortfolioVideos,
  addPortfolioVideo,
  removePortfolioVideo,
} = require("../services/portfolioService");
const AppError = require("../utils/appError");

const getPortfolioVideosController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const result = await getPortfolioVideos(creatorId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching portfolio videos:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const addPortfolioVideoController = async (req, res) => {
  try {
    const userId = req.user.id;
    const creatorId = req.creatorId;
    const { mediaId } = req.body;

    if (!mediaId) {
      return res.status(400).json({ error: "mediaId is required." });
    }

    const portfolioVideo = await addPortfolioVideo(userId, creatorId, mediaId);
    return res.status(201).json({
      message: "Portfolio video added successfully.",
      portfolioVideo,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error adding portfolio video:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const removePortfolioVideoController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const { mediaId } = req.params;

    const result = await removePortfolioVideo(creatorId, mediaId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error removing portfolio video:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  getPortfolioVideosController,
  addPortfolioVideoController,
  removePortfolioVideoController,
};
