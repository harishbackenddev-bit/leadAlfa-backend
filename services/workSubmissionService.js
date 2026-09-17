const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const AppError = require("../utils/appError");

const WorkSubmission = require("../models/submissions/workSubmission.model");
const SubmissionRevision = require("../models/submissions/submissionRevision.model");
const SubmissionAsset = require("../models/submissions/submissionAsset.model");
const CreatorJob = require("../models/jobs/creatorJob.model");
const Media = require("../models/media/media.model");

const {
  REVISION_STATUSES,
  REVISION_STATUS_VALUES,
  ASSET_USAGE_TYPES,
  ASSET_USAGE_TYPE_VALUES,
  ASSET_REVIEW_STATUSES,
  ASSET_REVIEW_STATUS_VALUES,
  REVIEW_SOURCES,
  MAX_ASSETS_PER_TYPE,
  MAX_REVISIONS,
  REVIEW_WINDOW_DAYS,
  REMINDER_THROTTLE_HOURS,
  ACTIVITY_EVENT_TYPES,
} = require("../config/submissionConstants");
const { MS_PER_DAY } = require("../config/jobConstants");
const { logCampaignActivity: logSubmissionActivity } = require("./campaignActivityService");

const computeReviewDeadline = (fromDate = new Date()) =>
  new Date(fromDate.getTime() + REVIEW_WINDOW_DAYS * MS_PER_DAY);

const validateAssetsPayload = (assets) => {
  const countsPerType = {};

  for (const { usageType } of assets) {
    if (!ASSET_USAGE_TYPE_VALUES.includes(usageType)) {
      throw new AppError(
        `Invalid usageType "${usageType}". Must be one of: ${ASSET_USAGE_TYPE_VALUES.join(", ")}.`,
        400
      );
    }
    countsPerType[usageType] = (countsPerType[usageType] || 0) + 1;
    if (countsPerType[usageType] > MAX_ASSETS_PER_TYPE) {
      throw new AppError(
        `Maximum ${MAX_ASSETS_PER_TYPE} ${usageType} files allowed per submission.`,
        422
      );
    }
  }
};


const validateAndFetchMedia = async (mediaIds, userId, transaction) => {
  const uniqueIds = [...new Set(mediaIds)];

  const records = await Media.findAll({
    where: { id: uniqueIds },
    attributes: ["id", "name", "uploadedBy"],
    transaction,
  });

  const mediaMap = new Map();
  for (const record of records) {
    if (record.uploadedBy !== userId) {
      throw new AppError(
        `Media ID ${record.id} does not belong to you.`,
        403
      );
    }
    mediaMap.set(record.id, record);
  }

  for (const id of uniqueIds) {
    if (!mediaMap.has(id)) {
      throw new AppError(`Media ID ${id} not found.`, 400);
    }
  }

  return mediaMap;
};

const fetchScopedJob = async (jobPublicId, creatorId, transaction = null) => {
  const job = await CreatorJob.findOne({
    where: { publicId: jobPublicId, creatorId },
    attributes: ["id", "publicId", "status", "campaignId"],
    transaction,
  });

  if (!job) {
    throw new AppError("Creator job not found or access denied.", 404);
  }

  return job;
};

const fetchLatestRevision = async (submissionId, transaction = null) => {
  return SubmissionRevision.findOne({
    where: { submissionId },
    attributes: [
      "id",
      "publicId",
      "revisionNumber",
      "status",
      "lastReminderSentAt",
    ],
    order: [["revisionNumber", "DESC"]],
    transaction,
  });
};


const createSubmission = async (
  jobPublicId,
  creatorId,
  userId,
  { notes, captionOrHook, assets = [] },
  io
) => {
  
  if (!assets.length && !notes && !captionOrHook) {
    throw new AppError(
      "Submit at least one file or fill in notes / caption.",
      422
    );
  }

  if (assets.length) validateAssetsPayload(assets);

  const transaction = await sequelize.transaction();
  try {
    const job = await fetchScopedJob(jobPublicId, creatorId, transaction);

    if (!["ongoing"].includes(job.status)) {
      throw new AppError(
        `Cannot submit work for a job with status "${job.status}".`,
        403
      );
    }

    const existingSubmission = await WorkSubmission.findOne({
      where: { jobId: job.id },
      attributes: ["id"],
      transaction,
    });

    if (existingSubmission) {
      throw new AppError(
        "A submission already exists for this job. Use the resubmit endpoint.",
        409
      );
    }

    const mediaMap =
      assets.length
        ? await validateAndFetchMedia(
            assets.map((a) => a.mediaId),
            userId,
            transaction
          )
        : new Map();

    const submission = await WorkSubmission.create(
      { jobId: job.id, totalRevisionRequests: 0 },
      { transaction }
    );

    const now = new Date();
    const revision = await SubmissionRevision.create(
      {
        submissionId: submission.id,
        revisionNumber: 1,
        status: REVISION_STATUSES.PENDING_REVIEW,
        notes: notes || null,
        captionOrHook: captionOrHook || null,
        reviewDeadline: computeReviewDeadline(now),
        submittedAt: now,
        submittedByUserId: userId,
      },
      { transaction }
    );

    if (assets.length) {
      const assetRows = assets.map((a, idx) => ({
        revisionId: revision.id,
        mediaId: a.mediaId,
        usageType: a.usageType,
        assetName: mediaMap.get(a.mediaId).name,
        sortOrder: idx,
      }));

      await SubmissionAsset.bulkCreate(assetRows, {
        transaction,
        validate: true,
        individualHooks: true,
      });
    }

    await CreatorJob.update(
      { status: "submitted" },
      { where: { id: job.id }, transaction }
    );

    await transaction.commit();

    logSubmissionActivity({
      campaignId: job.campaignId,
      actorType: "creator",
      actorId: creatorId,
      eventType: ACTIVITY_EVENT_TYPES.SUBMISSION_CREATED,
      metadata: {
        submissionPublicId: submission.publicId,
        revisionPublicId: revision.publicId,
        revisionNumber: 1,
        assetCount: assets.length,
        reviewDeadline: revision.reviewDeadline,
      },
    });

    if (io) {
      const brandRoom = `private_brand_${await resolveBrandIdForJob(job.id)}`;
      io.to(brandRoom).emit("work_submission_update", {
        type: "submission_created",
        submissionPublicId: submission.publicId,
        revisionNumber: 1,
        jobPublicId,
        assetCount: assets.length,
        reviewDeadline: revision.reviewDeadline,
      });
    }

    return {
      submission: { publicId: submission.publicId },
      revision: {
        publicId: revision.publicId,
        revisionNumber: 1,
        status: revision.status,
        reviewDeadline: revision.reviewDeadline,
      },
    };
  } catch (err) {
    await transaction.rollback();

    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError(
        "A submission was already created for this job concurrently. Use the resubmit endpoint.",
        409
      );
    }

    throw err;
  }
};


const resubmitAfterRevision = async (
  jobPublicId,
  creatorId,
  userId,
  { notes, captionOrHook, assets = [] },
  io
) => {

  if (!assets.length && !notes && !captionOrHook) {
    throw new AppError(
      "Submit at least one file or fill in notes / caption.",
      422
    );
  }

  if (assets.length) validateAssetsPayload(assets);

  const transaction = await sequelize.transaction();
  try {
    const job = await fetchScopedJob(jobPublicId, creatorId, transaction);

    if (["approved", "cancelled"].includes(job.status)) {
      throw new AppError(
        `Cannot resubmit for a job with status "${job.status}".`,
        403
      );
    }

    const submission = await WorkSubmission.findOne({
      where: { jobId: job.id },
      attributes: ["id", "publicId", "totalRevisionRequests"],
      transaction,
    });

    if (!submission) {
      throw new AppError(
        "No submission found for this job. Use the initial submit endpoint first.",
        404
      );
    }

    const latestRevision = await fetchLatestRevision(submission.id, transaction);

    if (!latestRevision) {
      throw new AppError("No revision found for this submission.", 404);
    }

    if (
      latestRevision.status !== REVISION_STATUSES.REVISION_REQUESTED &&
      latestRevision.status !== REVISION_STATUSES.REJECTED
    ) {
      throw new AppError(
        `Cannot resubmit — the current revision status is "${latestRevision.status}". ` +
          `Resubmission is only allowed after a revision is requested or the submission is rejected.`,
        409
      );
    }

    const mediaMap =
      assets.length
        ? await validateAndFetchMedia(
            assets.map((a) => a.mediaId),
            userId,
            transaction
          )
        : new Map();

    const nextRevisionNumber = latestRevision.revisionNumber + 1;
    const now = new Date();

    const newRevision = await SubmissionRevision.create(
      {
        submissionId: submission.id,
        revisionNumber: nextRevisionNumber,
        status: REVISION_STATUSES.PENDING_REVIEW,
        notes: notes || null,
        captionOrHook: captionOrHook || null,
        reviewDeadline: computeReviewDeadline(now),
        submittedAt: now,
        submittedByUserId: userId,
      },
      { transaction }
    );

    if (assets.length) {
      const assetRows = assets.map((a, idx) => ({
        revisionId: newRevision.id,
        mediaId: a.mediaId,
        usageType: a.usageType,
        assetName: mediaMap.get(a.mediaId).name,
        sortOrder: idx,
      }));

      await SubmissionAsset.bulkCreate(assetRows, {
        transaction,
        validate: true,
        individualHooks: true,
      });
    }

    await CreatorJob.update(
      { status: "submitted" },
      { where: { id: job.id }, transaction }
    );

    await transaction.commit();

    logSubmissionActivity({
      campaignId: job.campaignId,
      actorType: "creator",
      actorId: creatorId,
      eventType: ACTIVITY_EVENT_TYPES.SUBMISSION_RESUBMITTED,
      metadata: {
        submissionPublicId: submission.publicId,
        revisionPublicId: newRevision.publicId,
        revisionNumber: nextRevisionNumber,
        assetCount: assets.length,
        reviewDeadline: newRevision.reviewDeadline,
      },
    });

    if (io) {
      const brandRoom = `private_brand_${await resolveBrandIdForJob(job.id)}`;
      io.to(brandRoom).emit("work_submission_update", {
        type: "submission_resubmitted",
        submissionPublicId: submission.publicId,
        revisionNumber: nextRevisionNumber,
        jobPublicId,
        assetCount: assets.length,
        reviewDeadline: newRevision.reviewDeadline,
      });
    }

    return {
      submission: { publicId: submission.publicId },
      revision: {
        publicId: newRevision.publicId,
        revisionNumber: nextRevisionNumber,
        status: newRevision.status,
        reviewDeadline: newRevision.reviewDeadline,
      },
    };
  } catch (err) {
    await transaction.rollback();

    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError(
        "A resubmission was already created for this revision round concurrently.",
        409
      );
    }

    throw err;
  }
};


const sendReminder = async (jobPublicId, creatorId, message, io) => {

  const job = await fetchScopedJob(jobPublicId, creatorId);

  const submission = await WorkSubmission.findOne({
    where: { jobId: job.id },
    attributes: ["id", "publicId"],
  });

  if (!submission) {
    throw new AppError("No submission found for this job.", 404);
  }

  const latestRevision = await fetchLatestRevision(submission.id);

  if (!latestRevision) {
    throw new AppError("No revision found for this submission.", 404);
  }

  if (latestRevision.status !== REVISION_STATUSES.PENDING_REVIEW) {
    throw new AppError(
      "Reminders can only be sent while the submission is awaiting review.",
      409
    );
  }


  const throttleMs = REMINDER_THROTTLE_HOURS * 60 * 60 * 1000;
  const now = new Date();

  if (latestRevision.lastReminderSentAt) {
    const nextAllowed = new Date(
      latestRevision.lastReminderSentAt.getTime() + throttleMs
    );
    if (now < nextAllowed) {
      throw new AppError(
        `You can send another reminder after ${nextAllowed.toISOString()}.`,
        429
      );
    }
  }

  await SubmissionRevision.update(
    { lastReminderSentAt: now },
    { where: { id: latestRevision.id } }
  );

  if (io) {
    const brandRoom = `private_brand_${await resolveBrandIdForJob(job.id)}`;
    io.to(brandRoom).emit("work_submission_update", {
      type: "submission_reminder",
      submissionPublicId: submission.publicId,
      revisionNumber: latestRevision.revisionNumber,
      jobPublicId,
      message: message || null,
    });
  }

  const nextReminderAvailableAt = new Date(now.getTime() + throttleMs);
  return { nextReminderAvailableAt };
};


const getJobSubmission = async (jobPublicId, creatorId) => {
  const job = await fetchScopedJob(jobPublicId, creatorId);

  const submission = await WorkSubmission.findOne({
    where: { jobId: job.id },
    attributes: ["id", "publicId", "totalRevisionRequests", "createdAt"],
    include: [
      {
        model: SubmissionRevision,
        as: "revisions",
        attributes: [
          "id",
          "publicId",
          "revisionNumber",
          "status",
          "notes",
          "captionOrHook",
          "revisionFeedback",
          "reviewDeadline",
          "lastReminderSentAt",
          "submittedAt",
          "reviewedAt",
          "reviewSource",
        ],
        order: [["revisionNumber", "DESC"]],
        include: [
          {
            model: SubmissionAsset,
            as: "assets",
            attributes: [
              "publicId",
              "usageType",
              "assetName",
              "sortOrder",
              "reviewStatus",
              "assetFeedback",
            ],
            include: [
              {
                model: Media,
                as: "mediaDetails",
                attributes: ["id", "url", "name", "type"],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!submission) {
    return null; 
  }

  return submission.toJSON();
};


const resolveBrandIdForJob = async (jobId) => {
  const Campaign = require("../models/campaigns/campaign.model");
  const job = await CreatorJob.findOne({
    where: { id: jobId },
    attributes: [],
    include: [
      {
        model: Campaign,
        as: "campaign",
        attributes: ["brandId"],
      },
    ],
  });
  return job?.campaign?.brandId;
};


const Campaign = require("../models/campaigns/campaign.model");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");

const fetchScopedCampaign = async (
  campaignPublicId,
  brandId,
  transaction = null
) => {
  const campaign = await Campaign.findOne({
    where: { publicId: campaignPublicId, brandId, isDeleted: false },
    attributes: ["id", "campaignTitle"],
    transaction,
  });

  if (!campaign) {
    throw new AppError(
      "Campaign not found or you do not have permission to access it.",
      404
    );
  }

  return campaign;
};


const getCampaignSubmissions = async (
  campaignPublicId,
  brandId,
  { status, page = 1, limit = 10 } = {}
) => {
  const { literal, Op } = require("sequelize");

  const campaign = await fetchScopedCampaign(campaignPublicId, brandId);

  const limitValue = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const pageValue = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageValue - 1) * limitValue;

  const isLatestRevision = literal(
    `"revisions"."id" = (SELECT id FROM "SubmissionRevisions" sr_inner
      WHERE sr_inner."submissionId" = "WorkSubmission"."id"
      ORDER BY sr_inner."revisionNumber" DESC
      LIMIT 1)`
  );

  const revisionWhere = { [Op.and]: [isLatestRevision] };
  if (status) {
    const validStatuses = REVISION_STATUS_VALUES;
    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status filter. Must be one of: ${validStatuses.join(", ")}.`,
        400
      );
    }
    revisionWhere.status = status;
  }

  const totalCount = await WorkSubmission.count({
    include: [
      {
        model: CreatorJob,
        as: "job",
        where: { campaignId: campaign.id },
        required: true,
        attributes: [],
      },
      {
        model: SubmissionRevision,
        as: "revisions",
        where: revisionWhere,
        required: true,
        attributes: [],
      },
    ],
    distinct: true,
    col: 'id',
  });

  const rows = await WorkSubmission.findAll({
    limit: limitValue,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: CreatorJob,
        as: "job",
        where: { campaignId: campaign.id },
        required: true,
        attributes: ["id", "publicId", "status", "agreedBudget", "deadlineAt"],
        include: [
          {
            model: CreatorProfile,
            as: "creator",
            required: true,
            attributes: ["id", "firstName", "lastName", "publicName"],
          },
        ],
      },
      {
        model: SubmissionRevision,
        as: "revisions",
        where: revisionWhere,
        required: true,
        attributes: [
          "publicId",
          "revisionNumber",
          "status",
          "submittedAt",
          "reviewDeadline",
          "reviewedAt",
          "revisionFeedback",
        ],
      },
    ],
  });

  const submissions = rows.map((row) => {
    const r = row.toJSON();
    return {
      submissionPublicId: r.publicId,
      totalRevisionRequests: r.totalRevisionRequests,
      createdAt: r.createdAt,
      job: r.job
        ? {
            publicId: r.job.publicId,
            status: r.job.status,
            agreedBudget: r.job.agreedBudget,
            deadlineAt: r.job.deadlineAt,
            creator: r.job.creator
              ? {
                  id: r.job.creator.id,
                  name:
                    r.job.creator.publicName ||
                    `${r.job.creator.firstName} ${r.job.creator.lastName}`,
                }
              : null,
          }
        : null,
      latestRevision: r.revisions?.[0] || null,
    };
  });

  return {
    submissions,
    pagination: {
      totalItems: totalCount,
      totalPages: limitValue > 0 ? Math.ceil(totalCount / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};


const getSubmissionDetail = async (submissionPublicId, brandId) => {
  const submission = await WorkSubmission.findOne({
    where: { publicId: submissionPublicId },
    attributes: ["id", "publicId", "totalRevisionRequests", "createdAt"],
    include: [
      {
        model: CreatorJob,
        as: "job",
        required: true,
        attributes: ["id", "publicId", "status"],
        include: [
          {
            model: Campaign,
            as: "campaign",
            where: { brandId },
            required: true,
            attributes: ["id", "publicId", "campaignTitle"],
          },
          {
            model: CreatorProfile,
            as: "creator",
            required: true,
            attributes: ["id", "firstName", "lastName", "publicName"],
          },
        ],
      },
      {
        model: SubmissionRevision,
        as: "revisions",
        attributes: [
          "id",
          "publicId",
          "revisionNumber",
          "status",
          "notes",
          "captionOrHook",
          "revisionFeedback",
          "reviewDeadline",
          "submittedAt",
          "reviewedAt",
          "reviewSource",
        ],
        order: [["revisionNumber", "DESC"]],
        include: [
          {
            model: SubmissionAsset,
            as: "assets",
            attributes: ["publicId", "usageType", "assetName", "sortOrder", "reviewStatus", "assetFeedback"],
            include: [
              {
                model: Media,
                as: "mediaDetails",
                attributes: ["id", "url", "name", "type"],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!submission) {
    throw new AppError("Submission not found or access denied.", 404);
  }

  return submission.toJSON();
};


const validateAssetFeedbackPayload = (assetFeedback) => {
  if (!Array.isArray(assetFeedback) || assetFeedback.length === 0) return;

  const seen = new Set();
  for (const entry of assetFeedback) {
    if (!entry.assetPublicId || typeof entry.assetPublicId !== "string") {
      throw new AppError("Each assetFeedback entry must include assetPublicId.", 400);
    }
    if (seen.has(entry.assetPublicId)) {
      throw new AppError(
        `Duplicate assetPublicId in assetFeedback array: ${entry.assetPublicId}.`,
        400
      );
    }
    seen.add(entry.assetPublicId);

    if (!ASSET_REVIEW_STATUS_VALUES.includes(entry.reviewStatus)) {
      throw new AppError(
        `Invalid reviewStatus "${entry.reviewStatus}" for asset ${entry.assetPublicId}. ` +
          `Must be one of: ${ASSET_REVIEW_STATUS_VALUES.join(", ")}.`,
        400
      );
    }

    if (entry.feedback && entry.feedback.length > 500) {
      throw new AppError(
        `Asset feedback for ${entry.assetPublicId} must not exceed 500 characters.`,
        400
      );
    }
  }
};


const applyAssetFeedback = async (revisionId, assetFeedback, transaction) => {
  if (!Array.isArray(assetFeedback) || assetFeedback.length === 0) return;

  const revisionAssets = await SubmissionAsset.findAll({
    where: { revisionId },
    attributes: ["id", "publicId"],
    transaction,
  });

  const assetMap = new Map(revisionAssets.map((a) => [a.publicId, a.id]));

  for (const entry of assetFeedback) {
    if (!assetMap.has(entry.assetPublicId)) {
      throw new AppError(
        `Asset ${entry.assetPublicId} does not belong to this revision.`,
        400
      );
    }
  }

  await Promise.all(
    assetFeedback.map((entry) =>
      SubmissionAsset.update(
        {
          reviewStatus: entry.reviewStatus,
          assetFeedback: entry.feedback || null,
        },
        {
          where: { id: assetMap.get(entry.assetPublicId) },
          transaction,
        }
      )
    )
  );
};


const approveSubmission = async (submissionPublicId, brandId, io) => {
  const transaction = await sequelize.transaction();
  try {
    const submission = await WorkSubmission.findOne({
      where: { publicId: submissionPublicId },
      attributes: ["id", "publicId", "jobId"],
      include: [
        {
          model: CreatorJob,
          as: "job",
          required: true,
          attributes: ["id", "publicId", "status", "campaignId"],
          include: [
            {
              model: Campaign,
              as: "campaign",
              where: { brandId },
              required: true,
              attributes: ["id", "brandId"],
            },
            {
              model: CreatorProfile,
              as: "creator",
              required: true,
              attributes: ["id"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!submission) {
      throw new AppError("Submission not found or access denied.", 404);
    }

    const job = submission.job;

    if (job.status === "approved") {
      throw new AppError("This submission has already been approved.", 409);
    }
    if (job.status === "cancelled") {
      throw new AppError("Cannot approve a cancelled job.", 409);
    }

    const latestRevision = await SubmissionRevision.findOne({
      where: { submissionId: submission.id },
      attributes: ["id", "publicId", "revisionNumber", "status"],
      order: [["revisionNumber", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!latestRevision) {
      throw new AppError("No revision found for this submission.", 404);
    }

    if (latestRevision.status !== REVISION_STATUSES.PENDING_REVIEW) {
      throw new AppError(
        `Cannot approve — the current revision status is "${latestRevision.status}". Only pending_review revisions can be approved.`,
        409
      );
    }

    const reviewedAt = new Date();

    await SubmissionRevision.update(
      {
        status: REVISION_STATUSES.APPROVED,
        reviewedAt,
        reviewedByBrandId: brandId,
        reviewSource: REVIEW_SOURCES.BRAND,
      },
      { where: { id: latestRevision.id }, transaction }
    );

    await SubmissionAsset.update(
      { reviewStatus: ASSET_REVIEW_STATUSES.APPROVED },
      { where: { revisionId: latestRevision.id }, transaction }
    );

    await CreatorJob.update(
      { status: "approved" },
      { where: { id: job.id }, transaction }
    );

    await transaction.commit();

    logSubmissionActivity({
      campaignId: job.campaign.id,
      actorType: "brand",
      actorId: brandId,
      eventType: ACTIVITY_EVENT_TYPES.SUBMISSION_APPROVED,
      metadata: {
        submissionPublicId,
        revisionPublicId: latestRevision.publicId,
        revisionNumber: latestRevision.revisionNumber,
        reviewSource: REVIEW_SOURCES.BRAND,
      },
    });

    if (io) {
      const creatorRoom = `private_creator_${job.creator.id}`;
      io.to(creatorRoom).emit("work_submission_update", {
        type: "submission_approved",
        submissionPublicId,
        revisionNumber: latestRevision.revisionNumber,
        jobPublicId: job.publicId,
      });
    }

    return {
      submissionPublicId,
      revision: {
        publicId: latestRevision.publicId,
        revisionNumber: latestRevision.revisionNumber,
        status: REVISION_STATUSES.APPROVED,
        reviewSource: REVIEW_SOURCES.BRAND,
        reviewedAt,
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};


const requestRevision = async (
  submissionPublicId,
  brandId,
  feedback,
  assetFeedback,
  io
) => {

  validateAssetFeedbackPayload(assetFeedback);

  const transaction = await sequelize.transaction();
  try {
    const submission = await WorkSubmission.findOne({
      where: { publicId: submissionPublicId },
      attributes: ["id", "publicId", "jobId", "totalRevisionRequests"],
      include: [
        {
          model: CreatorJob,
          as: "job",
          required: true,
          attributes: ["id", "publicId", "status", "campaignId"],
          include: [
            {
              model: Campaign,
              as: "campaign",
              where: { brandId },
              required: true,
              attributes: ["id", "brandId"],
            },
            {
              model: CreatorProfile,
              as: "creator",
              required: true,
              attributes: ["id"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!submission) {
      throw new AppError("Submission not found or access denied.", 404);
    }

    const job = submission.job;

    if (["approved", "cancelled"].includes(job.status)) {
      throw new AppError(
        `Cannot request revision for a job with status "${job.status}".`,
        409
      );
    }

    if (submission.totalRevisionRequests >= MAX_REVISIONS) {
      throw new AppError(
        `No further revisions can be requested. The maximum of ${MAX_REVISIONS} revision ` +
          `attempts has been reached. You may only approve this submission.`,
        409
      );
    }

    const latestRevision = await SubmissionRevision.findOne({
      where: { submissionId: submission.id },
      attributes: ["id", "publicId", "revisionNumber", "status"],
      order: [["revisionNumber", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!latestRevision) {
      throw new AppError("No revision found for this submission.", 404);
    }

    if (latestRevision.status !== REVISION_STATUSES.PENDING_REVIEW) {
      throw new AppError(
        `Cannot request revision — the current revision status is "${latestRevision.status}".`,
        409
      );
    }

    const reviewedAt = new Date();
    const newRevisionCount = submission.totalRevisionRequests + 1;
    const revisionsRemaining = MAX_REVISIONS - newRevisionCount;

    await SubmissionRevision.update(
      {
        status: REVISION_STATUSES.REVISION_REQUESTED,
        revisionFeedback: feedback,
        reviewedAt,
        reviewedByBrandId: brandId,
        reviewSource: REVIEW_SOURCES.BRAND,
      },
      { where: { id: latestRevision.id }, transaction }
    );

    await applyAssetFeedback(latestRevision.id, assetFeedback, transaction);

    await WorkSubmission.update(
      { totalRevisionRequests: newRevisionCount },
      { where: { id: submission.id }, transaction }
    );

    await CreatorJob.update(
      { status: "ongoing" },
      { where: { id: job.id }, transaction }
    );

    await transaction.commit();

    logSubmissionActivity({
      campaignId: job.campaign.id,
      actorType: "brand",
      actorId: brandId,
      eventType: ACTIVITY_EVENT_TYPES.REVISION_REQUESTED,
      metadata: {
        submissionPublicId,
        revisionPublicId: latestRevision.publicId,
        revisionNumber: latestRevision.revisionNumber,
        feedbackSnippet: feedback ? feedback.slice(0, 120) : null,
        revisionsRemaining,
      },
    });

    if (io) {
      io.to(`private_creator_${job.creator.id}`).emit(
        "work_submission_update",
        {
          type: "revision_requested",
          submissionPublicId,
          revisionNumber: latestRevision.revisionNumber,
          jobPublicId: job.publicId,
          feedback,
          revisionsRemaining,
        }
      );
    }

    return {
      submissionPublicId,
      autoRejected: false,
      revisionsRemaining,
      revision: {
        publicId: latestRevision.publicId,
        status: REVISION_STATUSES.REVISION_REQUESTED,
        revisionFeedback: feedback,
        reviewSource: REVIEW_SOURCES.BRAND,
        reviewedAt,
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};


const rejectSubmission = async (
  submissionPublicId,
  brandId,
  feedback,
  assetFeedback,
  io
) => {

  validateAssetFeedbackPayload(assetFeedback);

  const transaction = await sequelize.transaction();
  try {
    const submission = await WorkSubmission.findOne({
      where: { publicId: submissionPublicId },
      attributes: ["id", "publicId", "jobId", "totalRevisionRequests"],
      include: [
        {
          model: CreatorJob,
          as: "job",
          required: true,
          attributes: ["id", "publicId", "status"],
          include: [
            {
              model: Campaign,
              as: "campaign",
              where: { brandId },
              required: true,
              attributes: ["id"],
            },
            {
              model: CreatorProfile,
              as: "creator",
              required: true,
              attributes: ["id"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!submission) {
      throw new AppError("Submission not found or access denied.", 404);
    }

    const job = submission.job;

    if (["approved", "cancelled"].includes(job.status)) {
      throw new AppError(
        `Cannot reject — job is already "${job.status}".`,
        409
      );
    }

    if (submission.totalRevisionRequests >= MAX_REVISIONS) {
      throw new AppError(
        `No further rejections allowed. The maximum of ${MAX_REVISIONS} revision ` +
          `attempts has been reached. You may only approve this submission.`,
        409
      );
    }

    const latestRevision = await SubmissionRevision.findOne({
      where: { submissionId: submission.id },
      attributes: ["id", "publicId", "revisionNumber", "status"],
      order: [["revisionNumber", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!latestRevision) {
      throw new AppError("No revision found for this submission.", 404);
    }

    if (latestRevision.status !== REVISION_STATUSES.PENDING_REVIEW) {
      throw new AppError(
        `Cannot reject — the current revision status is "${latestRevision.status}". Only pending_review submissions can be rejected.`,
        409
      );
    }

    const reviewedAt = new Date();
    const newRevisionCount = submission.totalRevisionRequests + 1;
    const revisionsRemaining = MAX_REVISIONS - newRevisionCount;

    await SubmissionRevision.update(
      {
        status: REVISION_STATUSES.REJECTED,
        revisionFeedback: feedback,
        reviewedAt,
        reviewedByBrandId: brandId,
        reviewSource: REVIEW_SOURCES.BRAND,
      },
      { where: { id: latestRevision.id }, transaction }
    );

    await applyAssetFeedback(latestRevision.id, assetFeedback, transaction);

    await WorkSubmission.update(
      { totalRevisionRequests: newRevisionCount },
      { where: { id: submission.id }, transaction }
    );

    await CreatorJob.update(
      { status: "ongoing" },
      { where: { id: job.id }, transaction }
    );

    await transaction.commit();

    logSubmissionActivity({
      campaignId: job.campaign.id,
      actorType: "brand",
      actorId: brandId,
      eventType: ACTIVITY_EVENT_TYPES.SUBMISSION_REJECTED,
      metadata: {
        submissionPublicId,
        revisionPublicId: latestRevision.publicId,
        revisionNumber: latestRevision.revisionNumber,
        feedbackSnippet: feedback ? feedback.slice(0, 120) : null,
        revisionsRemaining,
      },
    });

    if (io) {
      io.to(`private_creator_${job.creator.id}`).emit(
        "work_submission_update",
        {
          type: "submission_rejected",
          submissionPublicId,
          revisionNumber: latestRevision.revisionNumber,
          jobPublicId: job.publicId,
          feedback,
          revisionsRemaining,
        }
      );
    }

    return {
      submissionPublicId,
      revisionsRemaining,
      revision: {
        publicId: latestRevision.publicId,
        revisionNumber: latestRevision.revisionNumber,
        status: REVISION_STATUSES.REJECTED,
        revisionFeedback: feedback,
        reviewSource: REVIEW_SOURCES.BRAND,
        reviewedAt,
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};


const getCampaignSubmissionStats = async (campaignPublicId, brandId) => {
  const { literal, QueryTypes } = require("sequelize");

  const campaign = await fetchScopedCampaign(campaignPublicId, brandId);

  const rows = await sequelize.query(
    `SELECT
       sr.status,
       COUNT(*)::int AS count
     FROM "WorkSubmissions" ws
     INNER JOIN "CreatorJobs" cj ON cj.id = ws."jobId" AND cj."campaignId" = :campaignId
     INNER JOIN "SubmissionRevisions" sr
       ON sr.id = (
         SELECT id FROM "SubmissionRevisions" sr_inner
         WHERE sr_inner."submissionId" = ws.id
         ORDER BY sr_inner."revisionNumber" DESC
         LIMIT 1
       )
     GROUP BY sr.status`,
    {
      replacements: { campaignId: campaign.id },
      type: QueryTypes.SELECT,
    }
  );

  const statusMap = Object.fromEntries(rows.map((r) => [r.status, r.count]));

  const pending     = statusMap[REVISION_STATUSES.PENDING_REVIEW]   || 0;
  const approved    = statusMap[REVISION_STATUSES.APPROVED]          || 0;
  const revisionReq = statusMap[REVISION_STATUSES.REVISION_REQUESTED] || 0;
  const rejected    = statusMap[REVISION_STATUSES.REJECTED]          || 0;
  const total       = pending + approved + revisionReq + rejected;

  return {
    campaignPublicId,
    stats: {
      total,
      pendingReview:      pending,
      approved,
      revisionRequested:  revisionReq,
      rejected,
    },
  };
};


const getApprovedAssets = async (
  campaignPublicId,
  brandId,
  { page = 1, limit = 10, usageType, search, sort = "uploadedAt" } = {}
) => {
  const campaign = await fetchScopedCampaign(campaignPublicId, brandId);

  if (usageType && !ASSET_USAGE_TYPE_VALUES.includes(usageType)) {
    throw new AppError(
      `Invalid usageType. Must be one of: ${ASSET_USAGE_TYPE_VALUES.join(", ")}.`,
      400
    );
  }

  const VALID_SORTS = ["uploadedAt", "approvedAt"];
  if (!VALID_SORTS.includes(sort)) {
    throw new AppError(
      `Invalid sort. Must be one of: ${VALID_SORTS.join(", ")}.`,
      400
    );
  }

  const limitValue = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const pageValue  = Math.max(1, parseInt(page, 10) || 1);
  const offset     = (pageValue - 1) * limitValue;

  const assetWhere = {};
  if (usageType) {
    assetWhere.usageType = usageType;
  }
  if (search && search.trim()) {
    assetWhere.assetName = { [Op.iLike]: `%${search.trim()}%` };
  }

  const revisionInclude = {
    model: SubmissionRevision,
    as: "revision",
    where: { status: REVISION_STATUSES.APPROVED },
    required: true,
    attributes: ["publicId", "reviewedAt"],
    include: [
      {
        model: WorkSubmission,
        as: "submission",
        required: true,
        attributes: ["publicId"],
        include: [
          {
            model: CreatorJob,
            as: "job",
            where: { campaignId: campaign.id },
            required: true,
            attributes: ["creatorId"], 
            include: [
              {
                model: CreatorProfile,
                as: "creator",
                required: true,
                attributes: ["id", "firstName", "lastName", "publicName"],
              },
            ],
          },
        ],
      },
    ],
  };

  const mediaInclude = {
    model: Media,
    as: "mediaDetails",
    required: true,
    attributes: ["url", "name", "type"],
  };

  const totalCount = await SubmissionAsset.count({
    where: assetWhere,
    include: [revisionInclude], 
    distinct: true,
    col: "id", 
  });

  const orderClause =
    sort === "approvedAt"
      ? [[{ model: SubmissionRevision, as: "revision" }, "reviewedAt", "DESC"]]
      : [["createdAt", "DESC"]];


  const rows = await SubmissionAsset.findAll({
    subQuery: false, 
    where: assetWhere,
    limit: limitValue,
    offset,
    order: orderClause,
    attributes: ["publicId", "assetName", "usageType", "sortOrder", "createdAt"],
    include: [
      {
        ...revisionInclude,
        include: [
          {
            model: WorkSubmission,
            as: "submission",
            required: true,
            attributes: ["publicId"],
            include: [
              {
                model: CreatorJob,
                as: "job",
                where: { campaignId: campaign.id },
                required: true,
                attributes: ["creatorId"], 
                include: [
                  {
                    model: CreatorProfile,
                    as: "creator",
                    required: true,
                    attributes: ["id", "firstName", "lastName", "publicName"],
                  },
                ],
              },
            ],
          },
        ],
      },
      mediaInclude,
    ],
  });


  const assets = rows.map((row) => {
    const a = row.toJSON();
    const creator = a.revision?.submission?.job?.creator || null;

    return {
      assetPublicId:  a.publicId,
      assetName:      a.assetName,
      assetType:      a.usageType,
      sortOrder:      a.sortOrder,
      uploadedAt:     a.createdAt,
      creator: creator
        ? {
            creatorId: creator.id,
            name:
              creator.publicName ||
              `${creator.firstName} ${creator.lastName}`.trim(),
          }
        : null,
      submission: { publicId: a.revision?.submission?.publicId || null },
      revision: {
        publicId:   a.revision?.publicId   || null,
        approvedAt: a.revision?.reviewedAt || null,
      },
      media: a.mediaDetails
        ? {
            url:  a.mediaDetails.url,
            name: a.mediaDetails.name,
            type: a.mediaDetails.type,
          }
        : null,
    };
  });

  return {
    assets,
    pagination: {
      totalItems:  totalCount,
      totalPages:  limitValue > 0 ? Math.ceil(totalCount / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};

module.exports = {
  createSubmission,
  resubmitAfterRevision,
  sendReminder,
  getJobSubmission,
  getCampaignSubmissions,
  getSubmissionDetail,
  approveSubmission,
  requestRevision,
  rejectSubmission,
  getCampaignSubmissionStats,
  getApprovedAssets,
};
