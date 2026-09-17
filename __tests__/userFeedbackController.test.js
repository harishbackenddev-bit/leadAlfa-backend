const userFeedbackController = require("../controllers/userFeedbackController");
const userFeedbackService = require("../services/userFeedbackService");
const AppError = require("../utils/appError");

jest.mock("../services/userFeedbackService");
jest.mock("express-validator", () => {
  const original = jest.requireActual("express-validator");
  return {
    ...original,
    validationResult: jest.fn(),
  };
});

const { validationResult } = require("express-validator");

describe("UserFeedback Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 42 },
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

  describe("submitUserFeedback", () => {
    it("should submit user feedback using authenticated userId from req.user.id and return 201 Created", async () => {
      req.user = { id: 42 };
      req.body = {
        type: "bug",
        description: "Save profile button does not trigger action.",
        pageUrl: "/creator/profile",
      };

      const mockResult = {
        success: true,
        message: "Thank you for your feedback. Your report has been submitted successfully.",
        publicId: "FBK-A82F91",
      };

      userFeedbackService.createUserFeedback.mockResolvedValue(mockResult);

      await userFeedbackController.submitUserFeedback(req, res);

      expect(userFeedbackService.createUserFeedback).toHaveBeenCalledWith(
        req.body,
        42
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it("should ignore userId passed in request body and use req.user.id", async () => {
      req.user = { id: 42 };
      req.body = {
        userId: 999, // Attempt to spoof userId
        type: "feedback",
        description: "Great application overall!",
      };

      const mockResult = { success: true, publicId: "FBK-B93E82" };
      userFeedbackService.createUserFeedback.mockResolvedValue(mockResult);

      await userFeedbackController.submitUserFeedback(req, res);

      expect(userFeedbackService.createUserFeedback).toHaveBeenCalledWith(
        req.body,
        42
      );
    });

    it("should return 400 when validation errors exist", async () => {
      validationResult.mockReturnValue({
        formatWith: () => ({
          isEmpty: () => false,
          array: () => [{ field: "type", message: "Type must be one of: bug, feedback." }],
        }),
      });

      await userFeedbackController.submitUserFeedback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ field: "type", message: "Type must be one of: bug, feedback." }],
      });
    });
  });

  describe("getUserFeedbacks", () => {
    it("should return paginated user feedbacks and 200 OK", async () => {
      req.query = { page: "1", limit: "10", status: "new", type: "bug" };
      const mockResult = {
        count: 15,
        rows: [{ publicId: "FBK-1" }],
        page: 1,
        limit: 10,
      };

      userFeedbackService.getUserFeedbacks.mockResolvedValue(mockResult);

      await userFeedbackController.getUserFeedbacks(req, res);

      expect(userFeedbackService.getUserFeedbacks).toHaveBeenCalledWith({
        page: "1",
        limit: "10",
        status: "new",
        type: "bug",
        search: undefined,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalItems: 15,
        totalPages: 2,
        currentPage: 1,
        limit: 10,
        data: [{ publicId: "FBK-1" }],
      });
    });
  });

  describe("getUserFeedbackByPublicId", () => {
    it("should return single user feedback detail by publicId", async () => {
      req.params.publicId = "FBK-A82F91";
      const mockDetail = { publicId: "FBK-A82F91", type: "bug" };
      userFeedbackService.getUserFeedbackByPublicId.mockResolvedValue(mockDetail);

      await userFeedbackController.getUserFeedbackByPublicId(req, res);

      expect(userFeedbackService.getUserFeedbackByPublicId).toHaveBeenCalledWith(
        "FBK-A82F91"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ feedback: mockDetail });
    });

    it("should return 404 when feedback is not found", async () => {
      req.params.publicId = "FBK-NONEXISTENT";
      userFeedbackService.getUserFeedbackByPublicId.mockRejectedValue(
        new AppError("User feedback not found", 404)
      );

      await userFeedbackController.getUserFeedbackByPublicId(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "User feedback not found",
      });
    });
  });

  describe("updateUserFeedback", () => {
    it("should update user feedback status/notes and return 200 OK", async () => {
      req.params.publicId = "FBK-A82F91";
      req.user = { id: 999 };
      req.body = { status: "in_progress", adminNotes: "Issue under investigation" };

      const mockUpdated = {
        publicId: "FBK-A82F91",
        status: "in_progress",
        adminNotes: "Issue under investigation",
      };

      userFeedbackService.updateUserFeedback.mockResolvedValue(mockUpdated);

      await userFeedbackController.updateUserFeedback(req, res);

      expect(userFeedbackService.updateUserFeedback).toHaveBeenCalledWith(
        "FBK-A82F91",
        req.body,
        999
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "User feedback updated successfully.",
        feedback: mockUpdated,
      });
    });
  });
});
