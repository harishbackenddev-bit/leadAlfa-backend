const { sequelize, Op } = require("../config/database");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const { uploadCampaignMedia, deleteMediaData } = require("../services/mediaService");
const campaignService = require("../services/campaignService");
const AppError = require("../utils/appError");

jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    define: jest.fn().mockReturnValue({}),
  },
  Op: { in: Symbol("in") }
}));
jest.mock("../models/campaigns/campaign.model", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findAndCountAll: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/campaigns/campaignMedia.model", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/campaigns/campaignInvoice.model", () => ({
  beforeValidate: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/brandProfile/brandProfile.model", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/campaigns/campaignApplication.model", () => ({
  count: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/media/media.model", () => ({}));
jest.mock("../services/mediaService", () => ({
  uploadCampaignMedia: jest.fn(),
  deleteMediaData: jest.fn(),
}));

describe("Campaign Service", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe("createCampaign", () => {
    it("should successfully create a campaign and upload media", async () => {
      const mockCampaign = { id: 1, brandId: 10, campaignTitle: "Test" };
      Campaign.create.mockResolvedValue(mockCampaign);
      
      const files = { coverImage: [{ filename: "test.jpg" }] };
      uploadCampaignMedia.mockResolvedValue({ id: 100, url: "http://test.jpg" });

      const result = await campaignService.createCampaign(1, 10, { campaignTitle: "Test" }, files);

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(Campaign.create).toHaveBeenCalledWith(
        { campaignTitle: "Test", brandId: 10 },
        { transaction: mockTransaction }
      );
      expect(uploadCampaignMedia).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.campaign).toEqual(mockCampaign);
      expect(result.media.coverImage).toBeDefined();
    });

    it("should rollback transaction if creation fails", async () => {
      Campaign.create.mockRejectedValue(new Error("DB Error"));
      
      await expect(
        campaignService.createCampaign(1, 10, { campaignTitle: "Test" }, {})
      ).rejects.toThrow("DB Error");

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("updateCampaign", () => {
    it("should throw error if campaign has applications", async () => {
      const mockCampaign = { id: 1, brandId: 10, update: jest.fn() };
      Campaign.findOne.mockResolvedValue(mockCampaign);
      CampaignApplication.count.mockResolvedValue(1); // Has 1 application!

      await expect(
        campaignService.updateCampaign(1, 10, "CMP-123", { campaignTitle: "New" }, {})
      ).rejects.toThrow(AppError);
      
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw error if brandId is unauthorized", async () => {
      const mockCampaign = { id: 1, brandId: 99 }; // Belongs to brand 99
      Campaign.findOne.mockResolvedValue(mockCampaign);

      await expect(
        campaignService.updateCampaign(1, 10, "CMP-123", {}, {}) // Brand 10 requesting
      ).rejects.toThrow(AppError);
    });

    it("should correctly update and return hydrated object", async () => {
      const mockCampaign = { id: 1, brandId: 10, update: jest.fn() };
      Campaign.findOne.mockResolvedValue(mockCampaign);
      CampaignApplication.count.mockResolvedValue(0);

      // We need to mock getCampaignById which is called internally at the end of updateCampaign
      // Instead of mocking the internal function, we mock Campaign.findOne again since getCampaignById calls it
      const hydratedCampaignMock = {
        toJSON: () => ({ id: 1, mediaLinks: [] })
      };
      // First call for update validation, Second call for getCampaignById hydration
      Campaign.findOne
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(hydratedCampaignMock);
        
      CampaignApplication.count
        .mockResolvedValueOnce(0) // update lock check
        .mockResolvedValueOnce(0); // getCampaignById hasApplications check

      const result = await campaignService.updateCampaign(1, 10, "CMP-123", { campaignTitle: "New" }, {});

      expect(mockCampaign.update).toHaveBeenCalledWith({ campaignTitle: "New" }, { transaction: mockTransaction });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result).toHaveProperty("hasApplications", false);
    });
  });

  describe("deleteCampaign", () => {
    it("should throw error if status is not closed", async () => {
      const mockCampaign = { publicId: "CMP-123", brandId: 10, status: "active", update: jest.fn() };
      Campaign.findOne.mockResolvedValue(mockCampaign);

      await expect(campaignService.deleteCampaign("CMP-123", 10)).rejects.toThrow(AppError);
    });

    it("should successfully soft delete a closed campaign", async () => {
      const mockCampaign = { publicId: "CMP-123", brandId: 10, status: "closed", update: jest.fn() };
      Campaign.findOne.mockResolvedValue(mockCampaign);

      const result = await campaignService.deleteCampaign("CMP-123", 10);
      expect(mockCampaign.update).toHaveBeenCalledWith({ isDeleted: true });
      expect(result).toBe(true);
    });
  });

  describe("getCampaignsByBrand", () => {
    it("should fetch lists and inject hasApplications", async () => {
      const mockBrand = { id: 10 };
      BrandProfile.findByPk.mockResolvedValue(mockBrand);

      const mockCampaign = {
        id: 1,
        toJSON: () => ({
          id: 1,
          mediaLinks: []
        })
      };

      Campaign.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign]
      });

      CampaignApplication.findAll.mockResolvedValue([
        { campaignId: 1, count: "5" }
      ]);

      const result = await campaignService.getCampaignsByBrand(10, null, 1, 10);

      expect(result.brand).toEqual(mockBrand);
      expect(result.campaigns[0].hasApplications).toBe(true);
      expect(result.pagination.totalItems).toBe(1);
    });
  });
});
