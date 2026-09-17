const bookCallRequestService = require("../services/bookCallRequestService");
const BookCallRequest = require("../models/bookCallRequest.model");
const AppError = require("../utils/appError");
const {
  sendAdminBookCallNotificationEmail,
} = require("../utils/email/emailProvider");

jest.mock("../models/bookCallRequest.model");
jest.mock("../utils/email/emailProvider");

describe("BookCallRequest Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createBookCallRequest", () => {
    it("should successfully create a new book a call request and trigger email notification for anonymous user", async () => {
      const mockPayload = {
        name: "  John Doe  ",
        businessEmail: " JOHN@COMPANY.COM ",
        companyName: " Acme Inc. ",
        companyWebsite: " https://acme.com ",
      };

      const mockDbRecord = {
        publicId: "CALL-A82F91",
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
        status: "new",
        createdAt: new Date(),
      };

      BookCallRequest.create.mockResolvedValue(mockDbRecord);
      sendAdminBookCallNotificationEmail.mockResolvedValue(true);

      const result = await bookCallRequestService.createBookCallRequest(mockPayload, null);

      expect(BookCallRequest.create).toHaveBeenCalledWith({
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
        userId: null,
        status: "new",
      });

      expect(result).toEqual({
        success: true,
        message: "Your call request has been received. Our team will contact you shortly.",
        publicId: "CALL-A82F91",
      });

      expect(sendAdminBookCallNotificationEmail).toHaveBeenCalledWith({
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
        publicId: "CALL-A82F91",
        createdAt: mockDbRecord.createdAt,
      });
    });

    it("should associate userId if submission is authenticated", async () => {
      const mockPayload = {
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
      };

      const mockDbRecord = {
        publicId: "CALL-A82F91",
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
        status: "new",
        createdAt: new Date(),
      };

      BookCallRequest.create.mockResolvedValue(mockDbRecord);
      sendAdminBookCallNotificationEmail.mockResolvedValue(true);

      await bookCallRequestService.createBookCallRequest(mockPayload, 101);

      expect(BookCallRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 101,
        })
      );
    });

    it("should succeed and retain DB record even if email notification fails", async () => {
      const mockPayload = {
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
      };

      const mockDbRecord = {
        publicId: "CALL-A82F91",
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
        status: "new",
        createdAt: new Date(),
      };

      BookCallRequest.create.mockResolvedValue(mockDbRecord);
      sendAdminBookCallNotificationEmail.mockRejectedValue(new Error("SMTP server down"));

      const result = await bookCallRequestService.createBookCallRequest(mockPayload);

      expect(BookCallRequest.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.publicId).toBe("CALL-A82F91");
    });
  });

  describe("getBookCallRequests", () => {
    it("should return paginated book a call requests for admin", async () => {
      const mockRows = [{ publicId: "CALL-1" }, { publicId: "CALL-2" }];
      BookCallRequest.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockRows,
      });

      const result = await bookCallRequestService.getBookCallRequests({
        page: 1,
        limit: 10,
        status: "new",
        search: "Acme",
      });

      expect(BookCallRequest.findAndCountAll).toHaveBeenCalled();
      expect(result).toEqual({
        count: 2,
        rows: mockRows,
        page: 1,
        limit: 10,
      });
    });

    it("should throw AppError for invalid status parameter", async () => {
      await expect(
        bookCallRequestService.getBookCallRequests({ status: "invalid_status" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getBookCallRequestByPublicId", () => {
    it("should return single request detail by publicId", async () => {
      const mockRecord = { publicId: "CALL-A82F91", name: "John Doe" };
      BookCallRequest.findOne.mockResolvedValue(mockRecord);

      const result = await bookCallRequestService.getBookCallRequestByPublicId("CALL-A82F91");

      expect(BookCallRequest.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicId: "CALL-A82F91" } })
      );
      expect(result).toBe(mockRecord);
    });

    it("should throw AppError 404 if request not found", async () => {
      BookCallRequest.findOne.mockResolvedValue(null);

      await expect(
        bookCallRequestService.getBookCallRequestByPublicId("CALL-NONEXISTENT")
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateBookCallRequest", () => {
    it("should update status and admin notes, setting resolvedAt and resolvedBy when status is resolved", async () => {
      const mockRecord = {
        publicId: "CALL-A82F91",
        status: "new",
        adminNotes: null,
        resolvedAt: null,
        resolvedBy: null,
        save: jest.fn().mockResolvedValue(true),
      };

      BookCallRequest.findOne.mockResolvedValue(mockRecord);

      const result = await bookCallRequestService.updateBookCallRequest(
        "CALL-A82F91",
        { status: "resolved", adminNotes: "Called client externally." },
        999
      );

      expect(mockRecord.status).toBe("resolved");
      expect(mockRecord.adminNotes).toBe("Called client externally.");
      expect(mockRecord.resolvedBy).toBe(999);
      expect(mockRecord.resolvedAt).toBeInstanceOf(Date);
      expect(mockRecord.save).toHaveBeenCalled();
    });

    it("should clear resolvedAt and resolvedBy if status transitions back from resolved", async () => {
      const mockRecord = {
        publicId: "CALL-A82F91",
        status: "resolved",
        adminNotes: "Resolved previously",
        resolvedAt: new Date(),
        resolvedBy: 999,
        save: jest.fn().mockResolvedValue(true),
      };

      BookCallRequest.findOne.mockResolvedValue(mockRecord);

      await bookCallRequestService.updateBookCallRequest(
        "CALL-A82F91",
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
