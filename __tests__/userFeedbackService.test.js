const userFeedbackService = require("../services/userFeedbackService");
const UserFeedback = require("../models/userFeedback.model");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const {
  sendAdminUserFeedbackNotificationEmail,
} = require("../utils/email/emailProvider");

jest.mock("../models/userFeedback.model");
jest.mock("../models/user.model");
jest.mock("../utils/email/emailProvider");

describe("UserFeedback Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createUserFeedback", () => {
    it("should successfully create a new bug report and trigger admin email notification", async () => {
      const mockPayload = {
        type: "bug",
        description: "  The profile save button does nothing.  ",
        pageUrl: " /creator/profile ",
      };

      const mockDbRecord = {
        publicId: "FBK-A82F91",
        type: "bug",
        description: "The profile save button does nothing.",
        pageUrl: "/creator/profile",
        status: "new",
        createdAt: new Date(),
      };

      const mockUser = {
        id: 42,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };

      UserFeedback.create.mockResolvedValue(mockDbRecord);
      User.findByPk.mockResolvedValue(mockUser);
      sendAdminUserFeedbackNotificationEmail.mockResolvedValue(true);

      const result = await userFeedbackService.createUserFeedback(
        mockPayload,
        42
      );

      expect(UserFeedback.create).toHaveBeenCalledWith({
        userId: 42,
        type: "bug",
        description: "The profile save button does nothing.",
        pageUrl: "/creator/profile",
        status: "new",
      });

      expect(result).toEqual({
        success: true,
        message: "Thank you for your feedback. Your report has been submitted successfully.",
        publicId: "FBK-A82F91",
      });

      expect(sendAdminUserFeedbackNotificationEmail).toHaveBeenCalledWith({
        publicId: "FBK-A82F91",
        type: "bug",
        description: "The profile save button does nothing.",
        pageUrl: "/creator/profile",
        userName: "Jane Doe",
        userEmail: "jane@example.com",
        createdAt: mockDbRecord.createdAt,
      });
    });

    it("should successfully create general feedback without pageUrl", async () => {
      const mockPayload = {
        type: "feedback",
        description: "Great platform experience!",
      };

      const mockDbRecord = {
        publicId: "FBK-B93E82",
        type: "feedback",
        description: "Great platform experience!",
        pageUrl: null,
        status: "new",
        createdAt: new Date(),
      };

      UserFeedback.create.mockResolvedValue(mockDbRecord);
      User.findByPk.mockResolvedValue(null);
      sendAdminUserFeedbackNotificationEmail.mockResolvedValue(true);

      const result = await userFeedbackService.createUserFeedback(
        mockPayload,
        99
      );

      expect(UserFeedback.create).toHaveBeenCalledWith({
        userId: 99,
        type: "feedback",
        description: "Great platform experience!",
        pageUrl: null,
        status: "new",
      });

      expect(result.publicId).toBe("FBK-B93E82");
    });

    it("should throw AppError 400 for invalid type", async () => {
      const mockPayload = {
        type: "invalid_type",
        description: "Some message here.",
      };

      await expect(
        userFeedbackService.createUserFeedback(mockPayload, 42)
      ).rejects.toThrow(AppError);
    });

    it("should succeed and retain DB record even if email notification fails", async () => {
      const mockPayload = {
        type: "bug",
        description: "Bug report description.",
      };

      const mockDbRecord = {
        publicId: "FBK-A82F91",
        type: "bug",
        description: "Bug report description.",
        pageUrl: null,
        status: "new",
        createdAt: new Date(),
      };

      UserFeedback.create.mockResolvedValue(mockDbRecord);
      User.findByPk.mockResolvedValue({ firstName: "Test", email: "test@example.com" });
      sendAdminUserFeedbackNotificationEmail.mockRejectedValue(new Error("Brevo service error"));

      const result = await userFeedbackService.createUserFeedback(mockPayload, 42);

      expect(UserFeedback.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.publicId).toBe("FBK-A82F91");
    });
  });

  describe("getUserFeedbacks", () => {
    it("should return paginated user feedbacks for admin", async () => {
      const mockRows = [{ publicId: "FBK-1" }, { publicId: "FBK-2" }];
      UserFeedback.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockRows,
      });

      const result = await userFeedbackService.getUserFeedbacks({
        page: 1,
        limit: 10,
        status: "new",
        type: "bug",
        search: "profile",
      });

      expect(UserFeedback.findAndCountAll).toHaveBeenCalled();
      expect(result).toEqual({
        count: 2,
        rows: mockRows,
        page: 1,
        limit: 10,
      });
    });

    it("should throw AppError for invalid status parameter", async () => {
      await expect(
        userFeedbackService.getUserFeedbacks({ status: "invalid_status" })
      ).rejects.toThrow(AppError);
    });

    it("should throw AppError for invalid type parameter", async () => {
      await expect(
        userFeedbackService.getUserFeedbacks({ type: "invalid_type" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getUserFeedbackByPublicId", () => {
    it("should return single feedback detail by publicId", async () => {
      const mockRecord = { publicId: "FBK-A82F91", type: "bug" };
      UserFeedback.findOne.mockResolvedValue(mockRecord);

      const result = await userFeedbackService.getUserFeedbackByPublicId("FBK-A82F91");

      expect(UserFeedback.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicId: "FBK-A82F91" } })
      );
      expect(result).toBe(mockRecord);
    });

    it("should throw AppError 404 if feedback not found", async () => {
      UserFeedback.findOne.mockResolvedValue(null);

      await expect(
        userFeedbackService.getUserFeedbackByPublicId("FBK-NONEXISTENT")
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateUserFeedback", () => {
    it("should update status and admin notes, setting resolvedAt and resolvedBy when status is resolved", async () => {
      const mockRecord = {
        publicId: "FBK-A82F91",
        status: "new",
        adminNotes: null,
        resolvedAt: null,
        resolvedBy: null,
        save: jest.fn().mockResolvedValue(true),
      };

      UserFeedback.findOne.mockResolvedValue(mockRecord);

      const result = await userFeedbackService.updateUserFeedback(
        "FBK-A82F91",
        { status: "resolved", adminNotes: "Fixed in production release." },
        999
      );

      expect(mockRecord.status).toBe("resolved");
      expect(mockRecord.adminNotes).toBe("Fixed in production release.");
      expect(mockRecord.resolvedBy).toBe(999);
      expect(mockRecord.resolvedAt).toBeInstanceOf(Date);
      expect(mockRecord.save).toHaveBeenCalled();
    });

    it("should clear resolvedAt and resolvedBy if status transitions back from resolved", async () => {
      const mockRecord = {
        publicId: "FBK-A82F91",
        status: "resolved",
        adminNotes: "Resolved previously",
        resolvedAt: new Date(),
        resolvedBy: 999,
        save: jest.fn().mockResolvedValue(true),
      };

      UserFeedback.findOne.mockResolvedValue(mockRecord);

      await userFeedbackService.updateUserFeedback(
        "FBK-A82F91",
        { status: "in_progress" },
        999
      );

      expect(mockRecord.status).toBe("in_progress");
      expect(mockRecord.resolvedBy).toBeNull();
      expect(mockRecord.resolvedAt).toBeNull();
      expect(mockRecord.save).toHaveBeenCalled();
    });
  });
});
