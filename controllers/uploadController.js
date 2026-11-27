const { generateUploadSignature } = require("../services/uploadService");
const AppError = require("../utils/appError");

const initiateSignatureController = async (req, res) => {
  try {
    const { resourceType, uploadType = "campaign_application" } = req.body;

    if (!resourceType) {
      return res.status(400).json({ error: "resourceType is required." });
    }

    if (!["video", "image", "raw"].includes(resourceType)) {
      return res.status(400).json({
        error: "resourceType must be 'video', 'image', or 'raw'.",
      });
    }

    if (!["campaign_application", "work_submission", "chat_media", "portfolio_video", "creator_intro_video"].includes(uploadType)) {
      return res.status(400).json({
        error: "uploadType must be 'campaign_application', 'work_submission', 'chat_media', 'portfolio_video', or 'creator_intro_video'.",
      });
    }

    const ticket = await generateUploadSignature({
      resourceType,
      uploadType,
      userId: req.user.id,
    });

    return res.status(200).json(ticket);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error generating upload signature:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = { initiateSignatureController };
