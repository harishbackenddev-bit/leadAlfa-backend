const { getHomepageCreatorVideos } = require("../services/homeService");
const AppError = require("../utils/appError");

const getHomepageCreatorVideosController = async (req, res) => {
  try {
    const { category } = req.query;
    const videos = await getHomepageCreatorVideos(category);

    return res.status(200).json({
      success: true,
      data: videos,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    console.error("Error fetching homepage creator videos:", error);
    return res.status(500).json({
      success: false,
      error: "Something went wrong fetching creator videos. Please try again later.",
    });
  }
};

module.exports = {
  getHomepageCreatorVideosController,
};
