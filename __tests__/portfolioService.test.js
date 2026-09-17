const {
  MAX_PORTFOLIO_VIDEOS,
  getPortfolioVideos,
  addPortfolioVideo,
  removePortfolioVideo,
} = require("../services/portfolioService");
const Media = require("../models/media/media.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const { deleteMediaData } = require("../services/mediaService");
const AppError = require("../utils/appError");

jest.mock("../models/media/media.model");
jest.mock("../models/creatorProfile/creatorMedia.model");
jest.mock("../services/mediaService", () => ({
  deleteMediaData: jest.fn(),
}));

describe("portfolioService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("MAX_PORTFOLIO_VIDEOS", () => {
    it("should be set to 5", () => {
      expect(MAX_PORTFOLIO_VIDEOS).toBe(5);
    });
  });

  describe("getPortfolioVideos", () => {
    it("should return empty list and full remaining allowance when no videos exist", async () => {
      CreatorMedia.findAll.mockResolvedValue([]);

      const result = await getPortfolioVideos(10);

      expect(result).toEqual({
        portfolioVideos: [],
        count: 0,
        maxAllowed: 5,
        remaining: 5,
      });
      expect(CreatorMedia.findAll).toHaveBeenCalledWith({
        where: {
          creatorId: 10,
          usageType: "portfolio",
        },
        include: [{ model: Media, as: "mediaDetails" }],
        order: [["createdAt", "ASC"], ["id", "ASC"]],
      });
    });

    it("should return formatted list and remaining count when videos exist", async () => {
      const mockRecords = [
        {
          toJSON: () => ({
            id: 1,
            creatorId: 10,
            mediaId: 101,
            usageType: "portfolio",
            mediaDetails: {
              id: 101,
              name: "video1.mp4",
              url: "https://cdn.example.com/video1.mp4",
              type: "video",
              provider: "cloudinary",
            },
          }),
        },
        {
          toJSON: () => ({
            id: 2,
            creatorId: 10,
            mediaId: 102,
            usageType: "portfolio",
            mediaDetails: {
              id: 102,
              name: "video2.mp4",
              url: "https://cdn.example.com/video2.mp4",
              type: "video",
              provider: "cloudinary",
            },
          }),
        },
      ];
      CreatorMedia.findAll.mockResolvedValue(mockRecords);

      const result = await getPortfolioVideos(10);

      expect(result.count).toBe(2);
      expect(result.remaining).toBe(3);
      expect(result.maxAllowed).toBe(5);
      expect(result.portfolioVideos).toHaveLength(2);
      expect(result.portfolioVideos[0].mediaId).toBe(101);
      expect(result.portfolioVideos[1].mediaId).toBe(102);
    });
  });

  describe("addPortfolioVideo", () => {
    const userId = 1;
    const creatorId = 10;
    const mediaId = 55;

    it("should throw AppError(400) if mediaId is invalid", async () => {
      await expect(addPortfolioVideo(userId, creatorId, null)).rejects.toThrow(AppError);
      await expect(addPortfolioVideo(userId, creatorId, "abc")).rejects.toThrow(AppError);
      await expect(addPortfolioVideo(userId, creatorId, -5)).rejects.toThrow(AppError);
    });

    it("should throw AppError(404) if Media is not found", async () => {
      Media.findByPk.mockResolvedValue(null);

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 404,
        message: "Media not found.",
      });
    });

    it("should throw AppError(403) if Media was uploaded by a different user", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: 999, // different user
        type: "video",
      });

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 403,
        message: "You do not have permission to use this media.",
      });
    });

    it("should throw AppError(400) if Media type is not video", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: userId,
        type: "image", // not video
      });

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 400,
        message: "Only video media can be added as portfolio videos.",
      });
    });

    it("should throw AppError(409) if video is already in creator's portfolio", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: userId,
        type: "video",
      });
      CreatorMedia.findOne.mockResolvedValueOnce({ id: 1, creatorId, mediaId, usageType: "portfolio" });

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 409,
        message: "This video is already in your portfolio.",
      });
    });

    it("should throw AppError(409) if media is already associated with any profile", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: userId,
        type: "video",
      });
      CreatorMedia.findOne
        .mockResolvedValueOnce(null) // not in portfolio for this creator
        .mockResolvedValueOnce({ id: 2, mediaId }); // already linked elsewhere

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 409,
        message: "This media is already associated with a profile.",
      });
    });

    it("should throw AppError(400) when creator already has 5 portfolio videos", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: userId,
        type: "video",
      });
      CreatorMedia.findOne.mockResolvedValue(null);
      CreatorMedia.count.mockResolvedValue(5); // already 5

      await expect(addPortfolioVideo(userId, creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 400,
        message: "Maximum portfolio videos (5) reached.",
      });
    });

    it("should successfully add portfolio video when under 5 limit", async () => {
      Media.findByPk.mockResolvedValue({
        id: mediaId,
        uploadedBy: userId,
        type: "video",
      });
      CreatorMedia.findOne.mockResolvedValue(null);
      CreatorMedia.count.mockResolvedValue(4); // currently 4, can add 5th
      CreatorMedia.create.mockResolvedValue({ id: 20 });

      const mockSaved = {
        toJSON: () => ({
          id: 20,
          creatorId,
          mediaId,
          usageType: "portfolio",
          mediaDetails: {
            id: mediaId,
            name: "new_portfolio.mp4",
            url: "https://cdn.example.com/new_portfolio.mp4",
            type: "video",
            provider: "cloudinary",
          },
        }),
      };
      CreatorMedia.findByPk.mockResolvedValue(mockSaved);

      const result = await addPortfolioVideo(userId, creatorId, mediaId);

      expect(CreatorMedia.create).toHaveBeenCalledWith({
        creatorId,
        mediaId,
        usageType: "portfolio",
      });
      expect(result.id).toBe(20);
      expect(result.mediaId).toBe(mediaId);
    });
  });

  describe("removePortfolioVideo", () => {
    const creatorId = 10;
    const mediaId = 55;

    it("should throw AppError(400) if mediaId is invalid", async () => {
      await expect(removePortfolioVideo(creatorId, null)).rejects.toThrow(AppError);
      await expect(removePortfolioVideo(creatorId, "invalid")).rejects.toThrow(AppError);
    });

    it("should throw AppError(404) if portfolio video not found for creator", async () => {
      CreatorMedia.findOne.mockResolvedValue(null);

      await expect(removePortfolioVideo(creatorId, mediaId)).rejects.toMatchObject({
        statusCode: 404,
        message: "Portfolio video not found.",
      });
    });

    it("should hard-delete CreatorMedia link and call deleteMediaData with deleteStorage=true", async () => {
      CreatorMedia.findOne.mockResolvedValue({
        id: 7,
        creatorId,
        mediaId,
        usageType: "portfolio",
      });
      CreatorMedia.destroy.mockResolvedValue(1);
      deleteMediaData.mockResolvedValue(["mock_storage_key"]);

      const result = await removePortfolioVideo(creatorId, mediaId);

      expect(CreatorMedia.destroy).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(deleteMediaData).toHaveBeenCalledWith([mediaId], null, true);
      expect(result).toEqual({ message: "Portfolio video removed successfully." });
    });
  });
});
