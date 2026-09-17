const contactController = require("../controllers/contactController");
const contactService = require("../services/contactService");
const AppError = require("../utils/appError");

jest.mock("../services/contactService");
jest.mock("express-validator", () => {
  const original = jest.requireActual("express-validator");
  return {
    ...original,
    validationResult: jest.fn(),
  };
});

const { validationResult } = require("express-validator");

describe("Contact Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => [],
      formatWith: jest.fn().mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      }),
    });
  });

  describe("submitContactRequest", () => {
    it("should submit contact request and return 201 Created", async () => {
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        inquiryType: "talk_to_sales",
        message: "Hello sales team!",
      };

      const mockResult = {
        publicId: "REQ-7F8E9D",
        name: "John Doe",
        email: "john@example.com",
        inquiryType: "talk_to_sales",
        status: "new",
        createdAt: new Date(),
      };

      contactService.createContactRequest.mockResolvedValue(mockResult);

      await contactController.submitContactRequest(req, res);

      expect(contactService.createContactRequest).toHaveBeenCalledWith(
        req.body,
        null
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Your request has been received. Our team will contact you shortly.",
        request: mockResult,
      });
    });

    it("should pass userId if user is authenticated", async () => {
      req.user = { id: 101 };
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        inquiryType: "talk_to_sales",
        message: "Hello sales team!",
      };

      const mockResult = { publicId: "REQ-7F8E9D" };
      contactService.createContactRequest.mockResolvedValue(mockResult);

      await contactController.submitContactRequest(req, res);

      expect(contactService.createContactRequest).toHaveBeenCalledWith(
        req.body,
        101
      );
    });

    it("should return 400 when validation errors exist", async () => {
      validationResult.mockReturnValue({
        formatWith: () => ({
          isEmpty: () => false,
          array: () => [{ field: "email", message: "Invalid email" }],
        }),
      });

      await contactController.submitContactRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ field: "email", message: "Invalid email" }],
      });
    });
  });

  describe("getContactRequests", () => {
    it("should return paginated contact requests and 200 OK", async () => {
      req.query = { page: "1", limit: "10", status: "new" };
      const mockResult = {
        count: 15,
        rows: [{ publicId: "REQ-1" }],
        page: 1,
        limit: 10,
      };

      contactService.getContactRequests.mockResolvedValue(mockResult);

      await contactController.getContactRequests(req, res);

      expect(contactService.getContactRequests).toHaveBeenCalledWith({
        page: "1",
        limit: "10",
        status: "new",
        inquiryType: undefined,
        search: undefined,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalItems: 15,
        totalPages: 2,
        currentPage: 1,
        limit: 10,
        data: [{ publicId: "REQ-1" }],
      });
    });
  });

  describe("getContactRequestByPublicId", () => {
    it("should return single contact request detail by publicId", async () => {
      req.params.publicId = "REQ-123";
      const mockDetail = { publicId: "REQ-123", name: "Test" };
      contactService.getContactRequestByPublicId.mockResolvedValue(mockDetail);

      await contactController.getContactRequestByPublicId(req, res);

      expect(contactService.getContactRequestByPublicId).toHaveBeenCalledWith(
        "REQ-123"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ request: mockDetail });
    });
  });

  describe("updateContactRequest", () => {
    it("should update contact request status/notes and return 200 OK", async () => {
      req.params.publicId = "REQ-123";
      req.user = { id: 999 };
      req.body = { status: "in_progress", adminNotes: "Called client" };

      const mockUpdated = {
        publicId: "REQ-123",
        status: "in_progress",
        adminNotes: "Called client",
      };

      contactService.updateContactRequest.mockResolvedValue(mockUpdated);

      await contactController.updateContactRequest(req, res);

      expect(contactService.updateContactRequest).toHaveBeenCalledWith(
        "REQ-123",
        req.body,
        999
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Contact request updated successfully.",
        request: mockUpdated,
      });
    });
  });
});
