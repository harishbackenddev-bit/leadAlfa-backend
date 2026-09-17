const { Op } = require("sequelize");
const UserFeedback = require("../models/userFeedback.model");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const {
  USER_FEEDBACK_TYPES,
  USER_FEEDBACK_STATUSES,
} = require("../config/userFeedbackConstants");
const {
  sendAdminUserFeedbackNotificationEmail,
} = require("../utils/email/emailProvider");

class UserFeedbackService {
  async createUserFeedback({ type, description, pageUrl }, userId) {
    const validTypes = Object.values(USER_FEEDBACK_TYPES);
    if (!validTypes.includes(type)) {
      throw new AppError(
        `Invalid feedback type. Allowed values: ${validTypes.join(", ")}`,
        400
      );
    }

    const trimmedDescription = description.trim();
    const trimmedPageUrl = pageUrl && typeof pageUrl === "string" ? pageUrl.trim() : null;

    const feedback = await UserFeedback.create({
      userId,
      type,
      description: trimmedDescription,
      pageUrl: trimmedPageUrl,
      status: "new",
    });

    try {
      const user = await User.findByPk(userId, {
        attributes: ["id", "firstName", "lastName", "email"],
      });

      const userName = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Authenticated User"
        : "Authenticated User";
      const userEmail = user ? user.email : "N/A";

      sendAdminUserFeedbackNotificationEmail({
        publicId: feedback.publicId,
        type: feedback.type,
        description: feedback.description,
        pageUrl: feedback.pageUrl,
        userName,
        userEmail,
        createdAt: feedback.createdAt,
      }).catch((err) => {
        console.error("Failed to send admin user-feedback notification email:", err.message);
      });
    } catch (err) {
      console.error("Error dispatching admin user-feedback notification email:", err.message);
    }

    return {
      success: true,
      message: "Thank you for your feedback. Your report has been submitted successfully.",
      publicId: feedback.publicId,
    };
  }

  async getUserFeedbacks({ page = 1, limit = 10, status, type, search }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    const whereClause = {};

    if (status) {
      if (!USER_FEEDBACK_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status parameter. Allowed values: ${USER_FEEDBACK_STATUSES.join(", ")}`,
          400
        );
      }
      whereClause.status = status;
    }

    if (type) {
      const validTypes = Object.values(USER_FEEDBACK_TYPES);
      if (!validTypes.includes(type)) {
        throw new AppError(
          `Invalid type parameter. Allowed values: ${validTypes.join(", ")}`,
          400
        );
      }
      whereClause.type = type;
    }

    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { publicId: { [Op.iLike]: searchTerm } },
        { description: { [Op.iLike]: searchTerm } },
        { "$userAccount.firstName$": { [Op.iLike]: searchTerm } },
        { "$userAccount.lastName$": { [Op.iLike]: searchTerm } },
        { "$userAccount.email$": { [Op.iLike]: searchTerm } },
      ];
    }

    const { count, rows } = await UserFeedback.findAndCountAll({
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

  async getUserFeedbackByPublicId(publicId) {
    const feedback = await UserFeedback.findOne({
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

    if (!feedback) {
      throw new AppError("User feedback not found", 404);
    }

    return feedback;
  }

  async updateUserFeedback(publicId, { status, adminNotes }, adminUserId) {
    const feedback = await UserFeedback.findOne({
      where: { publicId },
    });

    if (!feedback) {
      throw new AppError("User feedback not found", 404);
    }

    if (status !== undefined) {
      if (!USER_FEEDBACK_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status value. Allowed values: ${USER_FEEDBACK_STATUSES.join(", ")}`,
          400
        );
      }

      if (status === "resolved") {
        feedback.resolvedAt = new Date();
        feedback.resolvedBy = adminUserId;
      } else if (feedback.status === "resolved" && status !== "resolved") {
        feedback.resolvedAt = null;
        feedback.resolvedBy = null;
      }

      feedback.status = status;
    }

    if (adminNotes !== undefined) {
      feedback.adminNotes = adminNotes;
    }

    await feedback.save();
    return feedback;
  }
}

module.exports = new UserFeedbackService();
