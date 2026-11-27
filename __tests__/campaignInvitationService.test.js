const { sequelize } = require("../config/database");
const Campaign = require("../models/campaigns/campaign.model");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const CreatorJob = require("../models/jobs/creatorJob.model");
const CampaignInvitation = require("../models/campaigns/campaignInvitation.model");
const invitationService = require("../services/campaignInvitationService");
const AppError = require("../utils/appError");

jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    define: jest.fn().mockReturnValue({}),
  },
  Op: {
    in: Symbol("in"),
  },
}));

jest.mock("../models/campaigns/campaign.model", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../models/creatorProfile/creatorProfile.model", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/campaigns/campaignApplication.model", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/jobs/creatorJob.model", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/campaigns/campaignInvitation.model", () => ({
  findOne: jest.fn(),
  bulkCreate: jest.fn(),
  findAndCountAll: jest.fn(),
}));

describe("Campaign Invitation Service", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe("sendInvitations", () => {
    it("should successfully send invitations to creators", async () => {
      Campaign.findOne.mockResolvedValue({ id: 10, brandId: 2, status: "active" });
      CreatorProfile.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      CampaignInvitation.findOne.mockResolvedValue(null);
      CampaignApplication.findOne.mockResolvedValue(null);
      CreatorJob.findOne.mockResolvedValue(null);

      CampaignInvitation.bulkCreate.mockResolvedValue([
        { publicId: "INV-111111", creatorId: 1 },
        { publicId: "INV-222222", creatorId: 2 },
      ]);

      const result = await invitationService.sendInvitations(
        2,
        10,
        [1, 2],
        "Welcome message"
      );

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(Campaign.findOne).toHaveBeenCalled();
      expect(CreatorProfile.findAll).toHaveBeenCalled();
      expect(CampaignInvitation.bulkCreate).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].invitationId).toBe("INV-111111");
    });

    it("should throw error if campaign is inactive or not found", async () => {
      Campaign.findOne.mockResolvedValue(null);

      await expect(
        invitationService.sendInvitations(2, 10, [1, 2], "Welcome")
      ).rejects.toThrow(AppError);

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw error if any creator does not exist or is unapproved", async () => {
      Campaign.findOne.mockResolvedValue({ id: 10, brandId: 2 });
      CreatorProfile.findAll.mockResolvedValue([{ id: 1 }]); // Only found creator 1

      await expect(
        invitationService.sendInvitations(2, 10, [1, 2], "Welcome")
      ).rejects.toThrow("Invalid or unapproved creator IDs: 2");

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw error if a creator is already invited", async () => {
      Campaign.findOne.mockResolvedValue({ id: 10, brandId: 2 });
      CreatorProfile.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      CampaignInvitation.findOne.mockResolvedValue({ id: 99 }); // Already invited

      await expect(
        invitationService.sendInvitations(2, 10, [1, 2], "Welcome")
      ).rejects.toThrow("has already been invited");
    });
  });

  describe("getBrandInvitations", () => {
    it("should fetch sent invitations and pagination information", async () => {
      CampaignInvitation.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [
          {
            publicId: "INV-111",
            status: "pending",
            customMessage: "Hello",
            createdAt: new Date(),
            creator: { id: 1, firstName: "A", lastName: "B" },
            campaign: { id: 10, publicId: "CMP-0", campaignTitle: "C" },
            toJSON: function () {
              return this;
            },
          },
        ],
      });

      const result = await invitationService.getBrandInvitations(2, { page: 1, limit: 5 });
      expect(result.invitations).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.invitations[0].invitationId).toBe("INV-111");
    });
  });

  describe("withdrawInvitation", () => {
    it("should successfully delete a pending invitation", async () => {
      const mockDestroy = jest.fn();
      CampaignInvitation.findOne.mockResolvedValue({
        publicId: "INV-111",
        status: "pending",
        campaign: { brandId: 2 },
        destroy: mockDestroy,
      });

      const result = await invitationService.withdrawInvitation(2, "INV-111");
      expect(mockDestroy).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should fail if invitation is not in pending status", async () => {
      CampaignInvitation.findOne.mockResolvedValue({
        publicId: "INV-111",
        status: "accepted",
        campaign: { brandId: 2 },
        destroy: jest.fn(),
      });

      await expect(
        invitationService.withdrawInvitation(2, "INV-111")
      ).rejects.toThrow("Only pending invitations can be withdrawn.");
    });
  });

  describe("acceptInvitation", () => {
    it("should update status to accepted", async () => {
      const mockUpdate = jest.fn();
      CampaignInvitation.findOne.mockResolvedValue({
        publicId: "INV-111",
        status: "pending",
        campaignId: 10,
        update: mockUpdate,
      });
      Campaign.findByPk.mockResolvedValue({ publicId: "CMP-123" });

      const result = await invitationService.acceptInvitation(5, "INV-111");
      expect(mockUpdate).toHaveBeenCalledWith({ status: "accepted" });
      expect(result.status).toBe("accepted");
      expect(result.campaignPublicId).toBe("CMP-123");
    });
  });

  describe("declineInvitation", () => {
    it("should update status to declined", async () => {
      const mockUpdate = jest.fn();
      CampaignInvitation.findOne.mockResolvedValue({
        publicId: "INV-111",
        status: "pending",
        update: mockUpdate,
      });

      const result = await invitationService.declineInvitation(5, "INV-111");
      expect(mockUpdate).toHaveBeenCalledWith({ status: "declined" });
      expect(result.status).toBe("declined");
    });
  });
});
