const campaignController = require("../controllers/campaignController");
const campaignService = require("../services/campaignService");

jest.mock("../services/campaignService");
jest.mock("express-validator", () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    formatWith: jest.fn().mockReturnThis(),
    array: () => [],
  })),
}));

describe("Campaign Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1 },
      brandId: 10,
      params: {},
      body: {},
      files: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("createCampaignController", () => {
    it("should parse stringified arrays and empty strings to null", async () => {
      req.body = {
        campaignTitle: "Test Campaign",
        platform: '["TikTok", "Instagram"]', // Should be parsed to array
        minBudget: "", // Should be scrubbed to null
        petsRequired: "true", // Should be parsed to boolean
      };

      campaignService.createCampaign.mockResolvedValue({
        campaign: { id: 1 },
        media: {},
      });

      await campaignController.createCampaignController(req, res);

      // Verify parseCampaignBody correctly parsed the inputs before passing to the service
      expect(campaignService.createCampaign).toHaveBeenCalledWith(
        1, 
        10, 
        {
          campaignTitle: "Test Campaign",
          platform: ["TikTok", "Instagram"],
          minBudget: null,
          petsRequired: true,
        }, 
        {}
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Campaign created successfully"
      }));
    });
  });

  describe("updateCampaignController", () => {
    it("should correctly handle hydrated campaign response", async () => {
      req.params.publicId = "CMP-123";
      req.body = { campaignTitle: "Updated" };

      // Service returns a single flattened object because of getCampaignById execution
      const hydratedCampaign = { id: 1, campaignTitle: "Updated", media: { coverImage: null } };
      campaignService.updateCampaign.mockResolvedValue(hydratedCampaign);

      await campaignController.updateCampaignController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Campaign updated successfully",
        campaign: hydratedCampaign
      });
    });
  });

  describe("deleteCampaignController", () => {
    it("should call delete service and return success", async () => {
      req.params.publicId = "CMP-123";
      campaignService.deleteCampaign.mockResolvedValue(true);

      await campaignController.deleteCampaignController(req, res);

      expect(campaignService.deleteCampaign).toHaveBeenCalledWith("CMP-123", 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Campaign successfully deleted." });
    });
  });
});
