const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const {
  getCampaignSubmissions,
  getSubmissionDetail,
  approveSubmission,
  requestRevision,
  rejectSubmission,
  getCampaignSubmissionStats,
  getApprovedAssets,
} = require("../services/workSubmissionService");


const getCampaignSubmissionsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { campaignPublicId } = req.params;
    const brandId = req.brandId;
    const { status, page, limit } = req.query;

    const result = await getCampaignSubmissions(campaignPublicId, brandId, {
      status,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching campaign submissions:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const getSubmissionDetailController = async (req, res) => {
  try {
    const { submissionPublicId } = req.params;
    const brandId = req.brandId;

    const data = await getSubmissionDetail(submissionPublicId, brandId);

    return res.status(200).json({ submission: data });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching submission detail:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const approveSubmissionController = async (req, res) => {
  try {
    const { submissionPublicId } = req.params;
    const brandId = req.brandId;
    const io = req.app.get("io");

    const result = await approveSubmission(submissionPublicId, brandId, io);

    return res.status(200).json({
      message: "Submission approved successfully.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error approving submission:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const requestRevisionController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { submissionPublicId } = req.params;
    const brandId = req.brandId;
    const io = req.app.get("io");
    const { feedback, assetFeedback } = req.body;

    const result = await requestRevision(
      submissionPublicId,
      brandId,
      feedback,
      assetFeedback || [],
      io
    );

    return res.status(200).json({
      message: "Revision requested successfully.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error requesting revision:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const rejectSubmissionController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { submissionPublicId } = req.params;
    const brandId = req.brandId;
    const io = req.app.get("io");
    const { feedback, assetFeedback } = req.body;

    const result = await rejectSubmission(
      submissionPublicId,
      brandId,
      feedback,
      assetFeedback || [],
      io
    );

    return res.status(200).json({
      message: "Submission rejected.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error rejecting submission:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const getSubmissionStatsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { campaignPublicId } = req.params;
    const brandId = req.brandId;

    const result = await getCampaignSubmissionStats(campaignPublicId, brandId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching submission stats:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const getApprovedAssetsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { campaignPublicId } = req.params;
    const brandId = req.brandId;
    const { page, limit, usageType, search, sort } = req.query;

    const result = await getApprovedAssets(campaignPublicId, brandId, {
      page,
      limit,
      usageType,
      search,
      sort,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching approved assets:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

module.exports = {
  getCampaignSubmissionsController,
  getSubmissionDetailController,
  approveSubmissionController,
  requestRevisionController,
  rejectSubmissionController,
  getSubmissionStatsController,
  getApprovedAssetsController,
};
