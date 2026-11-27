const { validationResult } = require("express-validator");
const { UniqueConstraintError } = require("sequelize");
const AppError = require("../utils/appError");
const {
  applyToCampaign,
  getCreatorApplications,
  viewApplicants,
  updateApplicationStatus,
  withdrawApplication,
} = require("../services/campaignApplicationService");

const applyToCampaignController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const { campaignId } = req.params;
    const creatorId = req.creatorId;

    const result = await applyToCampaign(
      userId,
      campaignId,
      creatorId,
      req.body
    );
    return res.status(201).json({
      message: "Campaign Application submitted successfully.",
      application: result.application,
      media: result.media,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof UniqueConstraintError) {
      return res.status(409).json({
        error: "You have already applied to this campaign.",
      });
    }
    console.error("Error applying to campaign:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const withdrawApplicationController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const { applicationId } = req.params;

    await withdrawApplication(creatorId, applicationId);

    return res
      .status(200)
      .json({ message: "Application withdrawn successfully." });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error withdrawing application:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const getCreatorApplicationsController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const applications = await getCreatorApplications(creatorId);
    return res.status(200).json({ applications });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(
      "Error fetching creator campaign applications : ",
      err.message
    );
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const viewApplicantsController = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.query;
    const brandId = req.brandId;

    const applicants = await viewApplicants(campaignId, brandId, status);
    return res.status(200).json({ applicants });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching applicants : ", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const updateApplicationStatusController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { applicationId } = req.params;
    const { newStatus } = req.body;
    const brandId = req.brandId;

    const { application, chatRoom, job } = await updateApplicationStatus(
      applicationId,
      brandId,
      newStatus
    );

    if (newStatus === "accepted" && chatRoom) {
      const io = req.app.get("io");
      const creatorTarget = `private_creator_${application.creatorId}`;

      io.to(creatorTarget).emit("new_chat_available", {
        type: "CAMPAIGN_ACCEPTED",
        chatRoomId: chatRoom.id,
        campaignTitle: application.campaign?.title,
        brandId: brandId,
        message: `Great news! Your application for "${application.campaign?.campaignTitle}" is accepted.`,
      });
    }

    return res.status(200).json({
      message: `Application status updated to ${newStatus} successfully.`,
      application,
      chatRoomId: chatRoom ? chatRoom.id : null,
      jobId: job ? job.id : null,
      jobPublicId: job ? job.publicId : null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Failed to update application status : ", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  applyToCampaignController,
  withdrawApplicationController,
  getCreatorApplicationsController,
  viewApplicantsController,
  updateApplicationStatusController,
};
