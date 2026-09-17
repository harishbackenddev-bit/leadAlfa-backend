const { validationResult } = require("express-validator");
const userFeedbackService = require("../services/userFeedbackService");
const AppError = require("../utils/appError");

exports.submitUserFeedback = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const result = await userFeedbackService.createUserFeedback(
      req.body,
      userId
    );

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error submitting user feedback:", error);
    return res.status(500).json({ error: "Failed to submit user feedback" });
  }
};

exports.getUserFeedbacks = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, search } = req.query;
    const result = await userFeedbackService.getUserFeedbacks({
      page,
      limit,
      status,
      type,
      search,
    });

    return res.status(200).json({
      totalItems: result.count,
      totalPages: Math.ceil(result.count / result.limit),
      currentPage: result.page,
      limit: result.limit,
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching user feedbacks:", error);
    return res.status(500).json({ error: "Failed to fetch user feedbacks" });
  }
};

exports.getUserFeedbackByPublicId = async (req, res) => {
  try {
    const { publicId } = req.params;
    const feedback = await userFeedbackService.getUserFeedbackByPublicId(
      publicId
    );

    return res.status(200).json({ feedback });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching user feedback detail:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch user feedback detail" });
  }
};

exports.updateUserFeedback = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { publicId } = req.params;
    const adminUserId = req.user.id;
    const feedback = await userFeedbackService.updateUserFeedback(
      publicId,
      req.body,
      adminUserId
    );

    return res.status(200).json({
      message: "User feedback updated successfully.",
      feedback,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating user feedback:", error);
    return res.status(500).json({ error: "Failed to update user feedback" });
  }
};
