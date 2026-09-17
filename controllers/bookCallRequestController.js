const { validationResult } = require("express-validator");
const bookCallRequestService = require("../services/bookCallRequestService");
const AppError = require("../utils/appError");

exports.submitBookCallRequest = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user ? req.user.id : null;
    const result = await bookCallRequestService.createBookCallRequest(
      req.body,
      userId
    );

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error submitting book a call request:", error);
    return res.status(500).json({ error: "Failed to submit call request" });
  }
};

exports.getBookCallRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const result = await bookCallRequestService.getBookCallRequests({
      page,
      limit,
      status,
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
    console.error("Error fetching book a call requests:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch book a call requests" });
  }
};

exports.getBookCallRequestByPublicId = async (req, res) => {
  try {
    const { publicId } = req.params;
    const request = await bookCallRequestService.getBookCallRequestByPublicId(
      publicId
    );

    return res.status(200).json({ request });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching book a call request detail:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch book a call request detail" });
  }
};

exports.updateBookCallRequest = async (req, res) => {
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
    const request = await bookCallRequestService.updateBookCallRequest(
      publicId,
      req.body,
      adminUserId
    );

    return res.status(200).json({
      message: "Book a call request updated successfully.",
      request,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating book a call request:", error);
    return res
      .status(500)
      .json({ error: "Failed to update book a call request" });
  }
};
