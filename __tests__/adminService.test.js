const adminService = require("../services/adminService");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const User = require("../models/user.model");
const emailProvider = require("../utils/email/emailProvider");
const AppError = require("../utils/appError");
const { sequelize } = require("../config/database");

jest.mock("../models/creatorProfile/creatorProfile.model");
jest.mock("../models/brandProfile/brandProfile.model");
jest.mock("../models/user.model");
jest.mock("../utils/email/emailProvider");

jest.mock("../services/creatorProfileService", () => ({
  getCreatorUserId: jest.fn(),
  getCreatorProfile: jest.fn(),
}));
jest.mock("../services/brandProfileService", () => ({
  getBrandUserId: jest.fn(),
  getBrandProfile: jest.fn(),
}));

describe("Admin Service", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
      LOCK: { UPDATE: "UPDATE" },
    };
    jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("approveProfile", () => {
    it("should approve a pending profile and send an email", async () => {
      const mockSave = jest.fn();
      const mockProfile = {
        status: "pending",
        firstName: "John",
        userAccount: { email: "john@example.com" },
        save: mockSave,
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);
      emailProvider.sendProfileApprovedEmail.mockResolvedValue(true);

      const result = await adminService.approveProfile(1, 999);

      expect(result.status).toBe("approved");
      expect(result.reviewedBy).toBe(999);
      expect(mockSave).toHaveBeenCalled();
      expect(emailProvider.sendProfileApprovedEmail).toHaveBeenCalledWith(
        "john@example.com",
        "John"
      );
    });

    it("should throw an error if profile is already approved", async () => {
      const mockProfile = {
        status: "approved",
        firstName: "John",
        userAccount: { email: "john@example.com" },
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);

      await expect(adminService.approveProfile(1, 999)).rejects.toThrow(AppError);
      await expect(adminService.approveProfile(1, 999)).rejects.toThrow(
        "Profile is already approved"
      );
    });

    it("should throw an error if profile is rejected", async () => {
      const mockProfile = {
        status: "rejected",
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);

      await expect(adminService.approveProfile(1, 999)).rejects.toThrow(AppError);
      await expect(adminService.approveProfile(1, 999)).rejects.toThrow(
        "Cannot approve a rejected profile"
      );
    });

    it("should throw an error if profile not found", async () => {
      CreatorProfile.findByPk.mockResolvedValue(null);
      await expect(adminService.approveProfile(1, 999)).rejects.toThrow(
        "Profile not found"
      );
    });
  });

  describe("rejectProfile", () => {
    it("should reject a pending profile and send email", async () => {
      const mockSave = jest.fn();
      const mockProfile = {
        status: "pending",
        firstName: "John",
        userAccount: { email: "john@example.com" },
        save: mockSave,
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);
      emailProvider.sendProfileRejectedEmail.mockResolvedValue(true);

      const result = await adminService.rejectProfile(1, "Not a good fit", 999);
      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("Not a good fit");
      expect(mockSave).toHaveBeenCalled();
      expect(emailProvider.sendProfileRejectedEmail).toHaveBeenCalledWith(
        "john@example.com",
        "John",
        "Not a good fit"
      );
    });

    it("should throw an error if no reason provided", async () => {
      await expect(adminService.rejectProfile(1, "", 999)).rejects.toThrow(
        "Rejection reason is required"
      );
    });

    it("should throw an error if profile is already rejected", async () => {
      const mockProfile = {
        status: "rejected",
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);

      await expect(
        adminService.rejectProfile(1, "Not a good fit", 999)
      ).rejects.toThrow(AppError);
    });
  });

  describe("askClarification", () => {
    it("should request clarification for a pending profile", async () => {
      const mockSave = jest.fn();
      const mockProfile = {
        status: "pending",
        firstName: "John",
        userAccount: { email: "john@example.com" },
        save: mockSave,
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);
      emailProvider.sendProfileClarificationEmail.mockResolvedValue(true);

      const result = await adminService.askClarification(
        1,
        "Need more info",
        999
      );
      expect(result.status).toBe("clarification_requested");
      expect(result.clarificationRequested).toBe(true);
      expect(mockSave).toHaveBeenCalled();
      expect(emailProvider.sendProfileClarificationEmail).toHaveBeenCalledWith(
        "john@example.com",
        "John",
        "Need more info"
      );
    });

    it("should throw an error if profile is not pending", async () => {
      const mockProfile = {
        status: "approved",
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);
      await expect(
        adminService.askClarification(1, "Need more info", 999)
      ).rejects.toThrow(AppError);
    });
  });

  describe("getCreatorProfileRequests", () => {
    it("should return paginated profiles", async () => {
      const mockRows = [{ id: 1 }, { id: 2 }];
      CreatorProfile.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockRows,
      });

      const result = await adminService.getCreatorProfileRequests(
        "pending",
        1,
        10
      );
      expect(CreatorProfile.findAndCountAll).toHaveBeenCalled();
      expect(result.count).toBe(2);
      expect(result.rows).toEqual(mockRows);
      expect(result.page).toBe(1);
    });

    it("should throw an error for invalid status parameter", async () => {
      await expect(
        adminService.getCreatorProfileRequests("invalid_status", 1, 10)
      ).rejects.toThrow("Invalid status parameter");
    });
  });

  describe("deleteProfileRequest", () => {
    it("should mark a profile as deleted", async () => {
      const mockSave = jest.fn();
      const mockProfile = {
        id: 1,
        isDeleted: false,
        save: mockSave,
      };
      CreatorProfile.findByPk.mockResolvedValue(mockProfile);

      const result = await adminService.deleteProfileRequest(1);
      expect(result).toBe(true);
      expect(mockProfile.isDeleted).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  // --- Brand Profile Admin Operations Unit Tests ---

  describe("approveBrandProfile", () => {
    it("should approve a pending brand profile and send brand email", async () => {
      const mockSave = jest.fn();
      const mockSetDataValue = jest.fn();
      const mockProfile = {
        userId: 10,
        status: "pending",
        companyName: "Acme Corp",
        save: mockSave,
        setDataValue: mockSetDataValue,
      };
      BrandProfile.findByPk.mockResolvedValue(mockProfile);
      User.findByPk.mockResolvedValue({ id: 10, email: "acme@example.com" });
      emailProvider.sendBrandProfileApprovedEmail.mockResolvedValue(true);

      const result = await adminService.approveBrandProfile(1, 999);

      expect(result.status).toBe("approved");
      expect(result.reviewedBy).toBe(999);
      expect(mockSave).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(emailProvider.sendBrandProfileApprovedEmail).toHaveBeenCalledWith(
        "acme@example.com",
        "Acme Corp"
      );
    });

    it("should throw an error if brand profile is already approved", async () => {
      const mockProfile = {
        userId: 10,
        status: "approved",
        companyName: "Acme Corp",
      };
      BrandProfile.findByPk.mockResolvedValue(mockProfile);

      await expect(adminService.approveBrandProfile(1, 999)).rejects.toThrow(
        "Profile is already approved"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw an error if brand profile is not found", async () => {
      BrandProfile.findByPk.mockResolvedValue(null);
      await expect(adminService.approveBrandProfile(1, 999)).rejects.toThrow(
        "Profile not found"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("rejectBrandProfile", () => {
    it("should reject a pending brand profile and send rejection email", async () => {
      const mockSave = jest.fn();
      const mockSetDataValue = jest.fn();
      const mockProfile = {
        userId: 10,
        status: "pending",
        companyName: "Acme Corp",
        save: mockSave,
        setDataValue: mockSetDataValue,
      };
      BrandProfile.findByPk.mockResolvedValue(mockProfile);
      User.findByPk.mockResolvedValue({ id: 10, email: "acme@example.com" });
      emailProvider.sendBrandProfileRejectedEmail.mockResolvedValue(true);

      const result = await adminService.rejectBrandProfile(
        1,
        "Incomplete reg details",
        999
      );
      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("Incomplete reg details");
      expect(mockSave).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(emailProvider.sendBrandProfileRejectedEmail).toHaveBeenCalledWith(
        "acme@example.com",
        "Acme Corp",
        "Incomplete reg details"
      );
    });

    it("should throw error if rejection reason is missing", async () => {
      await expect(adminService.rejectBrandProfile(1, "", 999)).rejects.toThrow(
        "Rejection reason is required"
      );
    });
  });

  describe("askBrandClarification", () => {
    it("should request clarification for a pending brand profile", async () => {
      const mockSave = jest.fn();
      const mockSetDataValue = jest.fn();
      const mockProfile = {
        userId: 10,
        status: "pending",
        companyName: "Acme Corp",
        save: mockSave,
        setDataValue: mockSetDataValue,
      };
      BrandProfile.findByPk.mockResolvedValue(mockProfile);
      User.findByPk.mockResolvedValue({ id: 10, email: "acme@example.com" });
      emailProvider.sendBrandProfileClarificationEmail.mockResolvedValue(true);

      const result = await adminService.askBrandClarification(
        1,
        "Upload tax cert",
        999
      );
      expect(result.status).toBe("clarification_requested");
      expect(result.clarificationRequested).toBe(true);
      expect(mockSave).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(
        emailProvider.sendBrandProfileClarificationEmail
      ).toHaveBeenCalledWith("acme@example.com", "Acme Corp", "Upload tax cert");
    });
  });

  describe("getBrandProfileRequests", () => {
    it("should return paginated brand profile requests", async () => {
      const mockRows = [{ id: 1 }, { id: 2 }];
      BrandProfile.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockRows,
      });

      const result = await adminService.getBrandProfileRequests("pending", 1, 10);
      expect(BrandProfile.findAndCountAll).toHaveBeenCalled();
      expect(result.count).toBe(2);
      expect(result.rows).toEqual(mockRows);
      expect(result.page).toBe(1);
    });

    it("should throw an error for invalid status parameter", async () => {
      await expect(
        adminService.getBrandProfileRequests("invalid_status", 1, 10)
      ).rejects.toThrow("Invalid status parameter");
    });
  });

  describe("deleteBrandProfileRequest", () => {
    it("should mark brand profile as deleted", async () => {
      const mockSave = jest.fn();
      const mockProfile = {
        id: 1,
        isDeleted: false,
        save: mockSave,
      };
      BrandProfile.findByPk.mockResolvedValue(mockProfile);

      const result = await adminService.deleteBrandProfileRequest(1);
      expect(result).toBe(true);
      expect(mockProfile.isDeleted).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
