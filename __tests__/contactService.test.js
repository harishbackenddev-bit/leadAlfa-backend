const contactService = require("../services/contactService");
const ContactRequest = require("../models/contactRequest.model");
const AppError = require("../utils/appError");
const {
  sendAdminContactNotificationEmail,
} = require("../utils/email/emailProvider");

jest.mock("../models/contactRequest.model");
jest.mock("../utils/email/emailProvider");

describe("Contact Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createContactRequest", () => {
    it("should successfully create a new contact request and trigger email notification", async () => {
      const mockPayload = {
        name: "  Jane Doe  ",
        email: " JANE.DOE@Example.COM ",
        inquiryType: "talk_to_sales",
        message: " I would like to inquire about sales plans. ",
      };

      const mockDbRecord = {
        publicId: "REQ-123456",
        name: "Jane Doe",
        email: "jane.doe@example.com",
        inquiryType: "talk_to_sales",
        message: "I would like to inquire about sales plans.",
        status: "new",
        createdAt: new Date(),
      };

      ContactRequest.create.mockResolvedValue(mockDbRecord);
      sendAdminContactNotificationEmail.mockResolvedValue(true);

      const result = await contactService.createContactRequest(mockPayload, 42);

      expect(ContactRequest.create).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        inquiryType: "talk_to_sales",
        message: "I would like to inquire about sales plans.",
        userId: 42,
        status: "new",
      });

      expect(result).toEqual({
        publicId: "REQ-123456",
        name: "Jane Doe",
        email: "jane.doe@example.com",
        inquiryType: "talk_to_sales",
        status: "new",
        createdAt: mockDbRecord.createdAt,
      });

      expect(sendAdminContactNotificationEmail).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        inquiryType: "talk_to_sales",
        message: "I would like to inquire about sales plans.",
        publicId: "REQ-123456",
      });
    });

    it("should throw AppError 400 for invalid inquiryType", async () => {
      const mockPayload = {
        name: "Jane Doe",
        email: "jane@example.com",
        inquiryType: "invalid_type",
        message: "Valid message content here.",
      };

      await expect(
        contactService.createContactRequest(mockPayload)
      ).rejects.toThrow(AppError);
    });
  });

  describe("getContactRequests", () => {
    it("should return paginated contact requests", async () => {
      const mockRows = [{ publicId: "REQ-1" }, { publicId: "REQ-2" }];
      ContactRequest.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockRows,
      });

      const result = await contactService.getContactRequests({
        page: 1,
        limit: 10,
        status: "new",
      });

      expect(ContactRequest.findAndCountAll).toHaveBeenCalled();
      expect(result).toEqual({
        count: 2,
        rows: mockRows,
        page: 1,
        limit: 10,
      });
    });

    it("should throw AppError for invalid status parameter", async () => {
      await expect(
        contactService.getContactRequests({ status: "invalid_status" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getContactRequestByPublicId", () => {
    it("should return single contact request detail by publicId", async () => {
      const mockRecord = { publicId: "REQ-123456", name: "Test" };
      ContactRequest.findOne.mockResolvedValue(mockRecord);

      const result = await contactService.getContactRequestByPublicId("REQ-123456");

      expect(ContactRequest.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicId: "REQ-123456" } })
      );
      expect(result).toBe(mockRecord);
    });

    it("should throw AppError 404 if request not found", async () => {
      ContactRequest.findOne.mockResolvedValue(null);

      await expect(
        contactService.getContactRequestByPublicId("REQ-NONEXISTENT")
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateContactRequest", () => {
    it("should update status and admin notes, setting resolvedAt when status is resolved", async () => {
      const mockRecord = {
        publicId: "REQ-123456",
        status: "new",
        adminNotes: null,
        resolvedAt: null,
        resolvedBy: null,
        save: jest.fn().mockResolvedValue(true),
      };

      ContactRequest.findOne.mockResolvedValue(mockRecord);

      const result = await contactService.updateContactRequest(
        "REQ-123456",
        { status: "resolved", adminNotes: "All good" },
        999
      );

      expect(mockRecord.status).toBe("resolved");
      expect(mockRecord.adminNotes).toBe("All good");
      expect(mockRecord.resolvedBy).toBe(999);
      expect(mockRecord.resolvedAt).toBeInstanceOf(Date);
      expect(mockRecord.save).toHaveBeenCalled();
    });

    it("should clear resolvedAt and resolvedBy if status transitions back from resolved", async () => {
      const mockRecord = {
        publicId: "REQ-123456",
        status: "resolved",
        adminNotes: "Resolved previously",
        resolvedAt: new Date(),
        resolvedBy: 999,
        save: jest.fn().mockResolvedValue(true),
      };

      ContactRequest.findOne.mockResolvedValue(mockRecord);

      await contactService.updateContactRequest(
        "REQ-123456",
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
