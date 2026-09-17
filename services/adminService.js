const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const { sequelize } = require("../config/database");
const {
  sendProfileApprovedEmail,
  sendProfileRejectedEmail,
  sendProfileClarificationEmail,
  sendBrandProfileApprovedEmail,
  sendBrandProfileRejectedEmail,
  sendBrandProfileClarificationEmail,
} = require("../utils/email/emailProvider");

class AdminService {
  async getCreatorProfileById(id) {
    const creatorService = require("./creatorProfileService");
    const userId = await creatorService.getCreatorUserId(id);

    if (!userId) {
      throw new AppError("Profile not found", 404);
    }

    const profile = await creatorService.getCreatorProfile(userId, { maskSensitiveData: false });
    return profile;
  }

  async getCreatorProfileRequests(status, page = 1, limit = 10) {
    const validStatuses = ["draft", "pending", "approved", "rejected", "clarification_requested"];
    if (status && !validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status parameter. Allowed values: ${validStatuses.join(", ")}`,
        400
      );
    }

    const offset = (page - 1) * limit;
    const whereClause = { isDeleted: false };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await CreatorProfile.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    return { count, rows, page: parseInt(page), limit: parseInt(limit) };
  }

  async approveProfile(id, adminId) {
    const profile = await CreatorProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!profile) {
      const error = new Error("Profile not found");
      error.status = 404;
      throw error;
    }

    if (profile.status === "approved") {
      throw new AppError("Profile is already approved", 400);
    }
    if (profile.status === "rejected") {
      throw new AppError("Cannot approve a rejected profile", 400);
    }

    profile.status = "approved";
    profile.reviewedBy = adminId;
    profile.reviewedAt = new Date();
    await profile.save();

    await sendProfileApprovedEmail(profile.userAccount.email, profile.firstName);

    return profile;
  }

  async rejectProfile(id, reason, adminId) {
    if (!reason) {
      const error = new Error("Rejection reason is required");
      error.status = 400;
      throw error;
    }

    const profile = await CreatorProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!profile) {
      const error = new Error("Profile not found");
      error.status = 404;
      throw error;
    }

    if (profile.status === "rejected") {
      throw new AppError("Profile is already rejected", 400);
    }
    if (profile.status === "approved") {
      throw new AppError("Cannot reject an already approved profile", 400);
    }

    profile.status = "rejected";
    profile.rejectionReason = reason;
    profile.reviewedBy = adminId;
    profile.reviewedAt = new Date();
    await profile.save();

    await sendProfileRejectedEmail(
      profile.userAccount.email,
      profile.firstName,
      reason
    );

    return profile;
  }

  async askClarification(id, message, adminId) {
    if (!message) {
      const error = new Error("Clarification message is required");
      error.status = 400;
      throw error;
    }

    const profile = await CreatorProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!profile) {
      const error = new Error("Profile not found");
      error.status = 404;
      throw error;
    }

    if (profile.status !== "pending") {
      throw new AppError(
        `Cannot request clarification for a profile with status: ${profile.status}`,
        400
      );
    }

    profile.status = "clarification_requested";
    profile.clarificationRequested = true;
    profile.reviewedBy = adminId;
    profile.reviewedAt = new Date();
    await profile.save();

    await sendProfileClarificationEmail(
      profile.userAccount.email,
      profile.firstName,
      message
    );

    return profile;
  }

  async deleteProfileRequest(id) {
    const profile = await CreatorProfile.findByPk(id);

    if (!profile) {
      const error = new Error("Profile not found");
      error.status = 404;
      throw error;
    }

    profile.isDeleted = true;
    await profile.save();

    return true;
  }

  // --- Brand Profile Admin Operations ---

  async getBrandProfileById(id) {
    const brandService = require("./brandProfileService");
    const userId = await brandService.getBrandUserId(id);

    if (!userId) {
      throw new AppError("Profile not found", 404);
    }

    const profile = await brandService.getBrandProfile(userId, { maskSensitiveData: false });
    return profile;
  }

  async getBrandProfileRequests(status, page = 1, limit = 10) {
    const validStatuses = ["draft", "pending", "approved", "rejected", "clarification_requested"];
    if (status && !validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status parameter. Allowed values: ${validStatuses.join(", ")}`,
        400
      );
    }

    const offset = (page - 1) * limit;
    const whereClause = { isDeleted: false };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await BrandProfile.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "userAccount",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    return { count, rows, page: parseInt(page), limit: parseInt(limit) };
  }

  async approveBrandProfile(id, adminId) {
    const t = await sequelize.transaction();
    let profile;
    try {
      const options = { transaction: t };
      if (t.LOCK && t.LOCK.UPDATE) {
        options.lock = t.LOCK.UPDATE;
      }
      profile = await BrandProfile.findByPk(id, options);

      if (!profile) {
        const error = new Error("Profile not found");
        error.status = 404;
        throw error;
      }

      if (profile.status === "approved") {
        throw new AppError("Profile is already approved", 400);
      }
      if (profile.status === "rejected") {
        throw new AppError("Cannot approve a rejected profile", 400);
      }

      profile.status = "approved";
      profile.reviewedBy = adminId;
      profile.reviewedAt = new Date();
      await profile.save({ transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    const userAccount = await User.findByPk(profile.userId, {
      attributes: ["id", "firstName", "lastName", "email"],
    });
    if (userAccount) {
      profile.setDataValue("userAccount", userAccount);
      await sendBrandProfileApprovedEmail(
        userAccount.email,
        profile.companyName
      );
    }

    return profile;
  }

  async rejectBrandProfile(id, reason, adminId) {
    if (!reason) {
      const error = new Error("Rejection reason is required");
      error.status = 400;
      throw error;
    }

    const t = await sequelize.transaction();
    let profile;
    try {
      const options = { transaction: t };
      if (t.LOCK && t.LOCK.UPDATE) {
        options.lock = t.LOCK.UPDATE;
      }
      profile = await BrandProfile.findByPk(id, options);

      if (!profile) {
        const error = new Error("Profile not found");
        error.status = 404;
        throw error;
      }

      if (profile.status === "rejected") {
        throw new AppError("Profile is already rejected", 400);
      }
      if (profile.status === "approved") {
        throw new AppError("Cannot reject an already approved profile", 400);
      }

      profile.status = "rejected";
      profile.rejectionReason = reason;
      profile.reviewedBy = adminId;
      profile.reviewedAt = new Date();
      await profile.save({ transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    const userAccount = await User.findByPk(profile.userId, {
      attributes: ["id", "firstName", "lastName", "email"],
    });
    if (userAccount) {
      profile.setDataValue("userAccount", userAccount);
      await sendBrandProfileRejectedEmail(
        userAccount.email,
        profile.companyName,
        reason
      );
    }

    return profile;
  }

  async askBrandClarification(id, message, adminId) {
    if (!message) {
      const error = new Error("Clarification message is required");
      error.status = 400;
      throw error;
    }

    const t = await sequelize.transaction();
    let profile;
    try {
      const options = { transaction: t };
      if (t.LOCK && t.LOCK.UPDATE) {
        options.lock = t.LOCK.UPDATE;
      }
      profile = await BrandProfile.findByPk(id, options);

      if (!profile) {
        const error = new Error("Profile not found");
        error.status = 404;
        throw error;
      }

      if (profile.status !== "pending") {
        throw new AppError(
          `Cannot request clarification for a profile with status: ${profile.status}`,
          400
        );
      }

      profile.status = "clarification_requested";
      profile.clarificationRequested = true;
      profile.reviewedBy = adminId;
      profile.reviewedAt = new Date();
      await profile.save({ transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    const userAccount = await User.findByPk(profile.userId, {
      attributes: ["id", "firstName", "lastName", "email"],
    });
    if (userAccount) {
      profile.setDataValue("userAccount", userAccount);
      await sendBrandProfileClarificationEmail(
        userAccount.email,
        profile.companyName,
        message
      );
    }

    return profile;
  }

  async deleteBrandProfileRequest(id) {
    const profile = await BrandProfile.findByPk(id);

    if (!profile) {
      const error = new Error("Profile not found");
      error.status = 404;
      throw error;
    }

    profile.isDeleted = true;
    await profile.save();

    return true;
  }
}

module.exports = new AdminService();
