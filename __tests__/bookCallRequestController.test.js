const bookCallRequestController = require("../controllers/bookCallRequestController");
const bookCallRequestService = require("../services/bookCallRequestService");
const AppError = require("../utils/appError");

jest.mock("../services/bookCallRequestService");
jest.mock("express-validator", () => {
  const original = jest.requireActual("express-validator");
  return {
    ...original,
    validationResult: jest.fn(),
  };
});

const { validationResult } = require("express-validator");

describe("BookCallRequest Controller", () => {
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

  describe("submitBookCallRequest", () => {
    it("should submit book call request and return 201 Created", async () => {
      req.body = {
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
      };

      const mockResult = {
        success: true,
        message: "Your call request has been received. Our team will contact you shortly.",
        publicId: "CALL-A82F91",
      };

      bookCallRequestService.createBookCallRequest.mockResolvedValue(mockResult);

      await bookCallRequestController.submitBookCallRequest(req, res);

      expect(bookCallRequestService.createBookCallRequest).toHaveBeenCalledWith(
        req.body,
        null
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it("should pass userId if user is authenticated", async () => {
      req.user = { id: 101 };
      req.body = {
        name: "John Doe",
        businessEmail: "john@company.com",
        companyName: "Acme Inc.",
        companyWebsite: "https://acme.com",
      };

      const mockResult = { success: true, publicId: "CALL-A82F91" };
      bookCallRequestService.createBookCallRequest.mockResolvedValue(mockResult);

      await bookCallRequestController.submitBookCallRequest(req, res);

      expect(bookCallRequestService.createBookCallRequest).toHaveBeenCalledWith(
        req.body,
        101
      );
    });

    it("should return 400 when validation errors exist", async () => {
      validationResult.mockReturnValue({
        formatWith: () => ({
          isEmpty: () => false,
          array: () => [{ field: "businessEmail", message: "Invalid email" }],
        }),
      });

      await bookCallRequestController.submitBookCallRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ field: "businessEmail", message: "Invalid email" }],
      });
    });
  });

  describe("getBookCallRequests", () => {
    it("should return paginated book a call requests and 200 OK", async () => {
      req.query = { page: "1", limit: "10", status: "new" };
      const mockResult = {
        count: 15,
        rows: [{ publicId: "CALL-1" }],
        page: 1,
        limit: 10,
      };

      bookCallRequestService.getBookCallRequests.mockResolvedValue(mockResult);

      await bookCallRequestController.getBookCallRequests(req, res);

      expect(bookCallRequestService.getBookCallRequests).toHaveBeenCalledWith({
        page: "1",
        limit: "10",
        status: "new",
        search: undefined,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalItems: 15,
        totalPages: 2,
        currentPage: 1,
        limit: 10,
        data: [{ publicId: "CALL-1" }],
      });
    });
  });

  describe("getBookCallRequestByPublicId", () => {
    it("should return single book call request detail by publicId", async () => {
      req.params.publicId = "CALL-A82F91";
      const mockDetail = { publicId: "CALL-A82F91", name: "John Doe" };
      bookCallRequestService.getBookCallRequestByPublicId.mockResolvedValue(mockDetail);

      await bookCallRequestController.getBookCallRequestByPublicId(req, res);

      expect(bookCallRequestService.getBookCallRequestByPublicId).toHaveBeenCalledWith(
        "CALL-A82F91"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ request: mockDetail });
    });

    it("should return 404 when request is not found", async () => {
      req.params.publicId = "CALL-NONEXISTENT";
      bookCallRequestService.getBookCallRequestByPublicId.mockRejectedValue(
        new AppError("Book a call request not found", 404)
      );

      await bookCallRequestController.getBookCallRequestByPublicId(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Book a call request not found",
      });
    });
  });

  describe("updateBookCallRequest", () => {
    it("should update book call request status/notes and return 200 OK", async () => {
      req.params.publicId = "CALL-A82F91";
      req.user = { id: 999 };
      req.body = { status: "in_progress", adminNotes: "Contacted client" };

      const mockUpdated = {
        publicId: "CALL-A82F91",
        status: "in_progress",
        adminNotes: "Contacted client",
      };

      bookCallRequestService.updateBookCallRequest.mockResolvedValue(mockUpdated);

      await bookCallRequestController.updateBookCallRequest(req, res);

      expect(bookCallRequestService.updateBookCallRequest).toHaveBeenCalledWith(
        "CALL-A82F91",
        req.body,
        999
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Book a call request updated successfully.",
        request: mockUpdated,
      });
    });
  });
});
