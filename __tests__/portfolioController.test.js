jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

const {
  getPortfolioVideosController,
  addPortfolioVideoController,
  removePortfolioVideoController,
} = require("../controllers/portfolioController");
const portfolioService = require("../services/portfolioService");
const AppError = require("../utils/appError");

jest.mock("../services/portfolioService");

describe("portfolioController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1 },
      creatorId: 10,
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("getPortfolioVideosController", () => {
    it("should return 200 with portfolio videos payload", async () => {
      const mockResult = {
        portfolioVideos: [],
        count: 0,
        maxAllowed: 5,
        remaining: 5,
      };
      portfolioService.getPortfolioVideos.mockResolvedValue(mockResult);

      await getPortfolioVideosController(req, res);

      expect(portfolioService.getPortfolioVideos).toHaveBeenCalledWith(10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it("should return AppError status code on error", async () => {
      portfolioService.getPortfolioVideos.mockRejectedValue(new AppError("Failed", 400));

      await getPortfolioVideosController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed" });
    });
  });

  describe("addPortfolioVideoController", () => {
    it("should return 400 if mediaId is missing in body", async () => {
      req.body = {};

      await addPortfolioVideoController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "mediaId is required." });
    });

    it("should return 201 on success", async () => {
      req.body = { mediaId: 42 };
      const mockEnriched = { id: 1, mediaId: 42, usageType: "portfolio" };
      portfolioService.addPortfolioVideo.mockResolvedValue(mockEnriched);

      await addPortfolioVideoController(req, res);

      expect(portfolioService.addPortfolioVideo).toHaveBeenCalledWith(1, 10, 42);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Portfolio video added successfully.",
        portfolioVideo: mockEnriched,
      });
    });

    it("should handle AppError appropriately", async () => {
      req.body = { mediaId: 42 };
      portfolioService.addPortfolioVideo.mockRejectedValue(
        new AppError("Maximum portfolio videos (5) reached.", 400)
      );

      await addPortfolioVideoController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Maximum portfolio videos (5) reached.",
      });
    });
  });

  describe("removePortfolioVideoController", () => {
    it("should return 200 on successful removal", async () => {
      req.params = { mediaId: "42" };
      portfolioService.removePortfolioVideo.mockResolvedValue({
        message: "Portfolio video removed successfully.",
      });

      await removePortfolioVideoController(req, res);

      expect(portfolioService.removePortfolioVideo).toHaveBeenCalledWith(10, "42");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Portfolio video removed successfully.",
      });
    });

    it("should return AppError status code when video not found", async () => {
      req.params = { mediaId: "42" };
      portfolioService.removePortfolioVideo.mockRejectedValue(
        new AppError("Portfolio video not found.", 404)
      );

      await removePortfolioVideoController(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Portfolio video not found.",
      });
    });
  });
});
