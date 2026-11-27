const { sequelize } = require("../config/database");
const CreatorJob = require("../models/jobs/creatorJob.model");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const Media = require("../models/media/media.model");
const AppError = require("../utils/appError");
const {
  CAMPAIGN_MEDIA_TYPES,
  BRAND_MEDIA_TYPES,
} = require("../config/mediaUsageTypes");
const {
  JOB_STATUSES,
  HIRING_SOURCES,
  DEFAULT_JOB_DEADLINE_DAYS,
  MS_PER_DAY,
} = require("../config/jobConstants");

/**
 * Resolve the agreed budget for a creator job based on the campaign and application proposed budget.
 *
 * @param {Object} campaign - The campaign instance or object
 * @param {Object} application - The campaign application instance or object
 * @returns {number|null} The resolved budget or null
 */
const resolveAgreedBudget = (campaign, application) => {
  if (!campaign) return null;
  if (campaign.compensationType === "Gift") return null;

  const proposed = application?.proposedBudget;
  if (proposed === undefined || proposed === null) return null;

  const budgetNum = Number(proposed);
  if (!Number.isFinite(budgetNum) || budgetNum < 0) {
    throw new AppError("Invalid application proposed budget.", 400);
  }

  return budgetNum;
};

/**
 * Compute the default deadline date starting from a baseline date.
 *
 * @param {Date} [fromDate=new Date()] - The baseline date
 * @returns {Date} The calculated deadline date
 */
const computeDefaultDeadline = (fromDate = new Date()) => {
  return new Date(fromDate.getTime() + DEFAULT_JOB_DEADLINE_DAYS * MS_PER_DAY);
};

/**
 * Create a new CreatorJob from an accepted campaign application.
 * Handles duplicate keys under concurrent race conditions safely.
 *
 * @param {Object} application - The campaign application object containing campaignId and creatorId
 * @param {Object} [options={}] - Query options including transaction context
 * @returns {Promise<Object>} An object containing the job record and a boolean 'created' indicator
 */
const createJobFromApplication = async (application, { transaction } = {}) => {
  if (!application || !application.campaignId || !application.creatorId) {
    throw new AppError(
      "Invalid application payload - campaignId and creatorId are required.",
      400
    );
  }

  const campaign =
    application.campaign ||
    (await Campaign.findByPk(application.campaignId, {
      attributes: ["id", "compensationType"],
      transaction,
    }));

  if (!campaign) {
    throw new AppError("Campaign not found for application.", 400);
  }

  const agreedBudget = resolveAgreedBudget(campaign, application);
  const deadlineAt = computeDefaultDeadline();

  let job;
  let created = false;

  try {
    const [foundOrCreatedJob, isNew] = await CreatorJob.findOrCreate({
      where: {
        campaignId: application.campaignId,
        creatorId: application.creatorId,
      },
      defaults: {
        campaignId: application.campaignId,
        creatorId: application.creatorId,
        applicationId: application.id,
        hiringSource: application.invitationId
          ? HIRING_SOURCES.DIRECT_INVITATION
          : HIRING_SOURCES.CAMPAIGN_APPLICATION,
        status: "ongoing",
        agreedBudget,
        deadlineAt,
      },
      transaction,
    });
    job = foundOrCreatedJob;
    created = isNew;
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      console.warn(
        `CreatorJob already exists for campaignId ${application.campaignId} and creatorId ${application.creatorId} due to concurrency. Retrying find...`
      );
      job = await CreatorJob.findOne({
        where: {
          campaignId: application.campaignId,
          creatorId: application.creatorId,
        },
        transaction,
      });
      created = false;
    } else {
      throw err;
    }
  }

  return { job, created };
};

/**
 * Map the raw latest revision status to the workStatus field exposed in the
 * creator job listing API.
 *
 * | latestRevisionStatus     | workStatus   | Meaning                                   |
 * |--------------------------|--------------|-------------------------------------------|
 * | null (no submission yet) | 'submit'     | Fresh job — creator needs to submit work  |
 * | 'revision_requested'     | 'resubmit'   | Brand asked for changes                   |
 * | 'rejected'               | 'resubmit'   | Brand rejected — creator must redo        |
 * | 'pending_review'         | null         | Awaiting brand review — no action needed  |
 * | 'approved'               | null         | Approved — no action needed               |
 *
 * @param {string|null} latestRevisionStatus
 * @returns {'submit'|'resubmit'|null}
 */
const resolveWorkStatus = (latestRevisionStatus) => {
  if (latestRevisionStatus === null || latestRevisionStatus === undefined) {
    return "submit";
  }
  if (
    latestRevisionStatus === "revision_requested" ||
    latestRevisionStatus === "rejected"
  ) {
    return "resubmit";
  }
  // pending_review or approved — no creator action required
  return null;
};

/**
 * Format the database job instance into a structured public card object.
 *
 * @param {Object} jobInstance - The database record instance or plain JSON object
 * @returns {Object|null} The formatted job card or null
 */
const formatJobCard = (jobInstance) => {
  if (!jobInstance) return null;

  const json =
    typeof jobInstance.toJSON === "function" ? jobInstance.toJSON() : jobInstance;
  const campaign = json.campaign || null;
  const brand = campaign?.brand || null;

  const campaignMediaLinks = campaign?.mediaLinks || [];
  const coverLink = campaignMediaLinks.find(
    (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.COVER_IMAGE
  );

  const brandMediaLinks = brand?.mediaLinks || [];
  const logoLink = brandMediaLinks.find(
    (m) => m.usageType === BRAND_MEDIA_TYPES.LOGO
  );

  return {
    jobId: json.id,
    publicId: json.publicId,
    status: json.status,
    workStatus: resolveWorkStatus(json.latestRevisionStatus),
    hiringSource: json.hiringSource,
    agreedBudget: json.agreedBudget,
    deadlineAt: json.deadlineAt,
    createdAt: json.createdAt,
    campaign: campaign
      ? {
          id: campaign.id,
          publicId: campaign.publicId,
          title: campaign.campaignTitle,
          status: campaign.status,
          compensationType: campaign.compensationType,
          thumbnail: coverLink ? coverLink.mediaDetails : null,
        }
      : null,
    brand: brand
      ? {
          id: brand.id,
          name: brand.companyName,
          logo: logoLink ? logoLink.mediaDetails : null,
        }
      : null,
  };
};

/**
 * Retrieve paginated jobs assigned to a creator, split-query optimized.
 *
 * @param {number} creatorId - The creator profile ID
 * @param {Object} [filters={}] - Optional query filters (status, page, limit)
 * @returns {Promise<Object>} Object containing the array of jobs and pagination metadata
 */
const getCreatorJobs = async (creatorId, { status, page = 1, limit = 10 } = {}) => {
  if (!creatorId) {
    throw new AppError("Creator context is required.", 400);
  }

  if (status && !JOB_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status. Must be one of: ${JOB_STATUSES.join(", ")}.`,
      400
    );
  }

  const limitValue = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Number(limit)))
    : 10;
  const pageValue = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
  const offset = (pageValue - 1) * limitValue;

  const where = { creatorId };
  if (status) where.status = status;

  const count = await CreatorJob.count({ where });

  const rows = await CreatorJob.findAll({
    where,
    limit: limitValue,
    offset,
    order: [["createdAt", "DESC"]],
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT sr.status
            FROM "WorkSubmissions" ws
            INNER JOIN "SubmissionRevisions" sr
              ON sr.id = (
                SELECT id FROM "SubmissionRevisions" sr2
                WHERE sr2."submissionId" = ws.id
                ORDER BY sr2."revisionNumber" DESC
                LIMIT 1
              )
            WHERE ws."jobId" = "CreatorJob"."id"
            LIMIT 1
          )`),
          "latestRevisionStatus",
        ],
      ],
    },
    include: [
      {
        model: Campaign,
        as: "campaign",
        attributes: [
          "id",
          "publicId",
          "campaignTitle",
          "status",
          "compensationType",
        ],
        include: [
          {
            model: BrandProfile,
            as: "brand",
            attributes: ["id", "companyName"],
            include: [
              {
                model: BrandMedia,
                as: "mediaLinks",
                where: { usageType: BRAND_MEDIA_TYPES.LOGO },
                required: false,
                include: [{ model: Media, as: "mediaDetails" }],
              },
            ],
          },
          {
            model: CampaignMedia,
            as: "mediaLinks",
            where: { usageType: CAMPAIGN_MEDIA_TYPES.COVER_IMAGE },
            required: false,
            include: [{ model: Media, as: "mediaDetails" }],
          },
        ],
      },
    ],
  });

  const jobs = rows.map(formatJobCard);

  return {
    jobs,
    pagination: {
      totalItems: count,
      totalPages: limitValue > 0 ? Math.ceil(count / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};

module.exports = {
  createJobFromApplication,
  getCreatorJobs,
  JOB_STATUSES,
  HIRING_SOURCES,
};
