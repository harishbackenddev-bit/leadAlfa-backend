const { validationResult } = require("express-validator");
const contactService = require("../services/contactService");
const AppError = require("../utils/appError");

exports.submitContactRequest = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user ? req.user.id : null;
    const result = await contactService.createContactRequest(req.body, userId);

    return res.status(201).json({
      message: "Your request has been received. Our team will contact you shortly.",
      request: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error submitting contact request:", error);
    return res.status(500).json({ error: "Failed to submit contact request" });
  }
};

exports.getContactRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, inquiryType, search } = req.query;
    const result = await contactService.getContactRequests({
      page,
      limit,
      status,
      inquiryType,
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
    console.error("Error fetching contact requests:", error);
    return res.status(500).json({ error: "Failed to fetch contact requests" });
  }
};

exports.getContactRequestByPublicId = async (req, res) => {
  try {
    const { publicId } = req.params;
    const request = await contactService.getContactRequestByPublicId(publicId);

    return res.status(200).json({ request });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching contact request detail:", error);
    return res.status(500).json({ error: "Failed to fetch contact request detail" });
  }
};

exports.updateContactRequest = async (req, res) => {
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
    const request = await contactService.updateContactRequest(
      publicId,
      req.body,
      adminUserId
    );

    return res.status(200).json({
      message: "Contact request updated successfully.",
      request,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating contact request:", error);
    return res.status(500).json({ error: "Failed to update contact request" });
  }
};
