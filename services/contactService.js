const { Op } = require("sequelize");
const ContactRequest = require("../models/contactRequest.model");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const {
  CONTACT_STATUSES,
  INQUIRY_CONFIG,
} = require("../config/contactConstants");
const {
  sendAdminContactNotificationEmail,
} = require("../utils/email/emailProvider");

class ContactService {
  async createContactRequest({ name, email, inquiryType, message }, userId = null) {
    const validInquiryKeys = Object.keys(INQUIRY_CONFIG);
    if (!validInquiryKeys.includes(inquiryType)) {
      throw new AppError(
        `Invalid inquiryType parameter. Allowed values: ${validInquiryKeys.join(", ")}`,
        400
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    const request = await ContactRequest.create({
      name: trimmedName,
      email: normalizedEmail,
      inquiryType,
      message: trimmedMessage,
      userId: userId || null,
      status: "new",
    });

    // Send asynchronous email notification (non-blocking)
    try {
      sendAdminContactNotificationEmail({
        name: request.name,
        email: request.email,
        inquiryType: request.inquiryType,
        message: request.message,
        publicId: request.publicId,
      }).catch((err) => {
        console.error("Failed to send admin contact notification email:", err.message);
      });
    } catch (err) {
      console.error("Error dispatching admin contact email notification:", err.message);
    }

    return {
      publicId: request.publicId,
      name: request.name,
      email: request.email,
      inquiryType: request.inquiryType,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  async getContactRequests({ page = 1, limit = 10, status, inquiryType, search }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    const whereClause = {};

    if (status) {
      if (!CONTACT_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status parameter. Allowed values: ${CONTACT_STATUSES.join(", ")}`,
          400
        );
      }
      whereClause.status = status;
    }

    if (inquiryType) {
      const validInquiryKeys = Object.keys(INQUIRY_CONFIG);
      if (!validInquiryKeys.includes(inquiryType)) {
        throw new AppError(
          `Invalid inquiryType parameter. Allowed values: ${validInquiryKeys.join(", ")}`,
          400
        );
      }
      whereClause.inquiryType = inquiryType;
    }

    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [Op.iLike]: searchTerm } },
        { email: { [Op.iLike]: searchTerm } },
        { publicId: { [Op.iLike]: searchTerm } },
        { message: { [Op.iLike]: searchTerm } },
      ];
    }

    const { count, rows } = await ContactRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parsedLimit,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      count,
      rows,
      page: parsedPage,
      limit: parsedLimit,
    };
  }

  async getContactRequestByPublicId(publicId) {
    const request = await ContactRequest.findOne({
      where: { publicId },
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "resolver",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!request) {
      throw new AppError("Contact request not found", 404);
    }

    return request;
  }

  async updateContactRequest(publicId, { status, adminNotes }, adminUserId) {
    const request = await ContactRequest.findOne({
      where: { publicId },
    });

    if (!request) {
      throw new AppError("Contact request not found", 404);
    }

    if (status !== undefined) {
      if (!CONTACT_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status value. Allowed values: ${CONTACT_STATUSES.join(", ")}`,
          400
        );
      }

      if (status === "resolved") {
        request.resolvedAt = new Date();
        request.resolvedBy = adminUserId;
      } else if (request.status === "resolved" && status !== "resolved") {
        request.resolvedAt = null;
        request.resolvedBy = null;
      }

      request.status = status;
    }

    if (adminNotes !== undefined) {
      request.adminNotes = adminNotes;
    }

    await request.save();
    return request;
  }
}

module.exports = new ContactService();
