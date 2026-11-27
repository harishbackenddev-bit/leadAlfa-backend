const { sequelize } = require("../config/database");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const Media = require("../models/media/media.model");
const CampaignInvitation = require("../models/campaigns/campaignInvitation.model");
const { linkMediaToEntity } = require("../services/mediaService");
const campaignApplicationService = require("../services/campaignApplicationService");
const AppError = require("../utils/appError");

jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    define: jest.fn().mockReturnValue({
      associate: jest.fn(),
    }),
  },
  Op: { in: Symbol("in") },
}));
jest.mock("../models/campaigns/campaign.model", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/campaigns/campaignApplication.model", () => ({
  create: jest.fn(),
}));
jest.mock("../models/media/media.model", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/campaigns/campaignInvitation.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("../services/mediaService", () => ({
  linkMediaToEntity: jest.fn(),
  deleteMediaData: jest.fn(),
}));
jest.mock("../services/chatRoomService", () => ({
  findOrCreateCampaignChatRoom: jest.fn(),
}));
jest.mock("../services/creatorJobService", () => ({
  createJobFromApplication: jest.fn(),
}));

describe("Campaign Application Service - applyToCampaign", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  it("should successfully apply to campaign using a mediaId", async () => {
    const mockCampaign = { id: 1, status: "active" };
    Campaign.findByPk.mockResolvedValue(mockCampaign);

    const mockInvitation = null;
    CampaignInvitation.findOne.mockResolvedValue(mockInvitation);

    const mockApplication = { id: 101, campaignId: 1, creatorId: 5 };
    CampaignApplication.create.mockResolvedValue(mockApplication);

    const mockMedia = { id: 200, name: "pitch.mp4", type: "video" };
    Media.findByPk.mockResolvedValue(mockMedia);

    linkMediaToEntity.mockResolvedValue({});

    const applicationData = { pitch: "I want to apply", mediaId: 200 };
    const result = await campaignApplicationService.applyToCampaign(12, 1, 5, applicationData);

    expect(sequelize.transaction).toHaveBeenCalled();
    expect(Campaign.findByPk).toHaveBeenCalledWith(1);
    expect(CampaignApplication.create).toHaveBeenCalledWith(
      {
        campaignId: 1,
        creatorId: 5,
        pitch: "I want to apply",
        applicationStatus: "pending",
        invitationId: null,
      },
      { transaction: mockTransaction }
    );
    expect(Media.findByPk).toHaveBeenCalledWith(200, { transaction: mockTransaction });
    expect(linkMediaToEntity).toHaveBeenCalledWith(
      "campaignApplication",
      101,
      200,
      "video_pitch",
      mockTransaction
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(result).toEqual({
      application: mockApplication,
      media: { pitchVideo: mockMedia },
    });
  });

  it("should throw error if campaign is inactive or not found", async () => {
    Campaign.findByPk.mockResolvedValue(null);

    const applicationData = { pitch: "I want to apply", mediaId: 200 };
    await expect(
      campaignApplicationService.applyToCampaign(12, 1, 5, applicationData)
    ).rejects.toThrow(AppError);

    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it("should throw error if mediaId is not found", async () => {
    const mockCampaign = { id: 1, status: "active" };
    Campaign.findByPk.mockResolvedValue(mockCampaign);

    CampaignApplication.create.mockResolvedValue({ id: 101 });
    Media.findByPk.mockResolvedValue(null);

    const applicationData = { pitch: "I want to apply", mediaId: 999 };
    await expect(
      campaignApplicationService.applyToCampaign(12, 1, 5, applicationData)
    ).rejects.toThrow(AppError);

    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});
