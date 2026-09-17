jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

const {
  checkPublicNameAvailabilityController,
  getProfile,
  getApprovedCreatorsList,
  reuploadDocumentsController,
} = require("../controllers/creatorProfileController");
const creatorProfileService = require("../services/creatorProfileService");
const AppError = require("../utils/appError");

jest.mock("../services/creatorProfileService");

describe("creatorProfileController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 42 },
      query: {},
      params: {},
      body: {},
      files: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("checkPublicNameAvailabilityController", () => {
    it("should return 200 with availability result", async () => {
      req.query = { name: "RajCreates" };
      creatorProfileService.checkPublicNameAvailability.mockResolvedValue({
        available: true,
      });

      await checkPublicNameAvailabilityController(req, res);

      expect(creatorProfileService.checkPublicNameAvailability).toHaveBeenCalledWith(42, "RajCreates");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ available: true });
    });

    it("should return AppError status code when service throws AppError", async () => {
      req.query = { name: "" };
      creatorProfileService.checkPublicNameAvailability.mockRejectedValue(
        new AppError("Name parameter is required.", 400)
      );

      await checkPublicNameAvailabilityController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Name parameter is required." });
    });

    it("should return 500 when unexpected error occurs", async () => {
      req.query = { name: "RajCreates" };
      creatorProfileService.checkPublicNameAvailability.mockRejectedValue(new Error("Database crash"));

      await checkPublicNameAvailabilityController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Something went wrong. Please try again later.",
      });
    });
  });

  describe("reuploadDocumentsController", () => {
    it("should return 200 and success message when documents are re-uploaded", async () => {
      req.files = {
        residencePermit: [{ originalname: "permit.pdf" }],
      };
      const mockResult = {
        profile: { id: 1, status: "pending" },
        media: { residencePermit: { id: "media-1", url: "https://example.com/permit.pdf" } },
      };
      creatorProfileService.reuploadCreatorDocuments.mockResolvedValue(mockResult);

      await reuploadDocumentsController(req, res);

      expect(creatorProfileService.reuploadCreatorDocuments).toHaveBeenCalledWith(42, req.files, null);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Documents re-uploaded successfully. Your profile has been resubmitted for review.",
        profile: mockResult.profile,
        media: mockResult.media,
      });
    });

    it("should return AppError statusCode and message when service throws AppError", async () => {
      req.files = {};
      creatorProfileService.reuploadCreatorDocuments.mockRejectedValue(
        new AppError("At least one document (residencePermit or introVideo) is required for re-upload.", 400)
      );

      await reuploadDocumentsController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "At least one document (residencePermit or introVideo) is required for re-upload.",
      });
    });

    it("should return 500 when unexpected error occurs", async () => {
      req.files = {
        introVideo: [{ originalname: "intro.mp4" }],
      };
      creatorProfileService.reuploadCreatorDocuments.mockRejectedValue(
        new Error("S3 failure")
      );

      await reuploadDocumentsController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Something went wrong. Please try again later.",
      });
    });
  });
});
