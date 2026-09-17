const { sequelize } = require("../config/database");
const Campaign = require("../models/campaigns/campaign.model");
const CreatorJob = require("../models/jobs/creatorJob.model");
const creatorJobService = require("../services/creatorJobService");
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
  findByPk: jest.fn(),
}));

jest.mock("../models/jobs/creatorJob.model", () => ({
  findOne: jest.fn(),
  findOrCreate: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
}));

describe("Creator Job Service", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe("createJobFromApplication", () => {
    it("should throw error if application payload is invalid", async () => {
      await expect(creatorJobService.createJobFromApplication(null)).rejects.toThrow(
        AppError
      );
      await expect(
        creatorJobService.createJobFromApplication({ campaignId: 1 })
      ).rejects.toThrow("campaignId and creatorId are required");
    });

    it("should throw error if campaign is not found", async () => {
      Campaign.findByPk.mockResolvedValue(null);

      await expect(
        creatorJobService.createJobFromApplication({ campaignId: 1, creatorId: 2 })
      ).rejects.toThrow("Campaign not found");
    });

    it("should successfully create job with campaign_application hiring source", async () => {
      Campaign.findByPk.mockResolvedValue({ id: 10, compensationType: "Cash" });
      const mockJob = { id: 100, publicId: "JOB-1", campaignId: 10, creatorId: 2 };
      CreatorJob.findOrCreate.mockResolvedValue([mockJob, true]);

      const result = await creatorJobService.createJobFromApplication({
        id: 5,
        campaignId: 10,
        creatorId: 2,
        proposedBudget: "150.00",
      });

      expect(CreatorJob.findOrCreate).toHaveBeenCalled();
      expect(result.job).toEqual(mockJob);
      expect(result.created).toBe(true);
      // verify hiringSource defaults to campaign_application
      const defaultsArg = CreatorJob.findOrCreate.mock.calls[0][0].defaults;
      expect(defaultsArg.hiringSource).toBe("campaign_application");
      expect(defaultsArg.agreedBudget).toBe(150);
    });

    it("should successfully create job with direct_invitation hiring source if invitationId exists", async () => {
      Campaign.findByPk.mockResolvedValue({ id: 10, compensationType: "Cash" });
      const mockJob = { id: 100, publicId: "JOB-1", campaignId: 10, creatorId: 2 };
      CreatorJob.findOrCreate.mockResolvedValue([mockJob, true]);

      await creatorJobService.createJobFromApplication({
        id: 5,
        campaignId: 10,
        creatorId: 2,
        proposedBudget: "150.00",
        invitationId: 999, // invitation exists
      });

      const defaultsArg = CreatorJob.findOrCreate.mock.calls[0][0].defaults;
      expect(defaultsArg.hiringSource).toBe("direct_invitation");
    });

    it("should handle SequelizeUniqueConstraintError gracefully by returning existing job", async () => {
      Campaign.findByPk.mockResolvedValue({ id: 10, compensationType: "Gift" });
      
      const constraintErr = new Error("Unique Constraint");
      constraintErr.name = "SequelizeUniqueConstraintError";
      CreatorJob.findOrCreate.mockRejectedValue(constraintErr);

      const mockExistingJob = { id: 200, publicId: "JOB-EXISTING" };
      CreatorJob.findOne.mockResolvedValue(mockExistingJob);

      const result = await creatorJobService.createJobFromApplication({
        id: 5,
        campaignId: 10,
        creatorId: 2,
      });

      expect(CreatorJob.findOne).toHaveBeenCalled();
      expect(result.job).toEqual(mockExistingJob);
      expect(result.created).toBe(false);
    });

    it("should throw error for invalid budgets on Cash campaigns", async () => {
      Campaign.findByPk.mockResolvedValue({ id: 10, compensationType: "Cash" });

      await expect(
        creatorJobService.createJobFromApplication({
          id: 5,
          campaignId: 10,
          creatorId: 2,
          proposedBudget: "invalid-number",
        })
      ).rejects.toThrow("Invalid application proposed budget.");
    });
  });

  describe("getCreatorJobs", () => {
    it("should throw error if creator context is missing", async () => {
      await expect(creatorJobService.getCreatorJobs(null)).rejects.toThrow(
        "Creator context is required."
      );
    });

    it("should throw error if status is invalid", async () => {
      await expect(
        creatorJobService.getCreatorJobs(1, { status: "invalid-status" })
      ).rejects.toThrow("Invalid status");
    });

    it("should perform safe pagination, run split count query, and format jobs list", async () => {
      CreatorJob.count.mockResolvedValue(1);
      
      const mockJobInstance = {
        id: 100,
        publicId: "JOB-1",
        status: "ongoing",
        hiringSource: "campaign_application",
        agreedBudget: "120.00",
        deadlineAt: new Date(),
        createdAt: new Date(),
        campaign: {
          id: 10,
          publicId: "CMP-EF",
          campaignTitle: "C1",
          status: "active",
          compensationType: "Cash",
          mediaLinks: [],
        },
        toJSON: function () {
          return this;
        },
      };
      
      CreatorJob.findAll.mockResolvedValue([mockJobInstance]);

      const result = await creatorJobService.getCreatorJobs(1, { page: -5, limit: 150 });
      
      // Page should be clamped to 1, limit clamped to 100
      expect(CreatorJob.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0,
        })
      );

      expect(CreatorJob.count).toHaveBeenCalled();
      expect(result.jobs).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.jobs[0].jobId).toBe(100);
    });
  });
});
