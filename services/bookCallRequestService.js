const { Op } = require("sequelize");
const BookCallRequest = require("../models/bookCallRequest.model");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const { BOOK_CALL_STATUSES } = require("../config/bookCallConstants");
const {
  sendAdminBookCallNotificationEmail,
} = require("../utils/email/emailProvider");

class BookCallRequestService {
  async createBookCallRequest(
    { name, businessEmail, companyName, companyWebsite },
    userId = null
  ) {
    const normalizedEmail = businessEmail.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedCompanyName = companyName.trim();
    const trimmedWebsite = companyWebsite.trim();

    const request = await BookCallRequest.create({
      name: trimmedName,
      businessEmail: normalizedEmail,
      companyName: trimmedCompanyName,
      companyWebsite: trimmedWebsite,
      userId: userId || null,
      status: "new",
    });

    try {
      sendAdminBookCallNotificationEmail({
        name: request.name,
        businessEmail: request.businessEmail,
        companyName: request.companyName,
        companyWebsite: request.companyWebsite,
        publicId: request.publicId,
        createdAt: request.createdAt,
      }).catch((err) => {
        console.error("Failed to send admin book-call notification email:", err.message);
      });
    } catch (err) {
      console.error("Error dispatching admin book-call notification email:", err.message);
    }

    return {
      success: true,
      message: "Your call request has been received. Our team will contact you shortly.",
      publicId: request.publicId,
    };
  }

  async getBookCallRequests({ page = 1, limit = 10, status, search }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    const whereClause = {};

    if (status) {
      if (!BOOK_CALL_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status parameter. Allowed values: ${BOOK_CALL_STATUSES.join(", ")}`,
          400
        );
      }
      whereClause.status = status;
    }

    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [Op.iLike]: searchTerm } },
        { businessEmail: { [Op.iLike]: searchTerm } },
        { companyName: { [Op.iLike]: searchTerm } },
        { publicId: { [Op.iLike]: searchTerm } },
      ];
    }

    const { count, rows } = await BookCallRequest.findAndCountAll({
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

  async getBookCallRequestByPublicId(publicId) {
    const request = await BookCallRequest.findOne({
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
      throw new AppError("Book a call request not found", 404);
    }

    return request;
  }

  async updateBookCallRequest(publicId, { status, adminNotes }, adminUserId) {
    const request = await BookCallRequest.findOne({
      where: { publicId },
    });

    if (!request) {
      throw new AppError("Book a call request not found", 404);
    }

    if (status !== undefined) {
      if (!BOOK_CALL_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status value. Allowed values: ${BOOK_CALL_STATUSES.join(", ")}`,
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

module.exports = new BookCallRequestService();
