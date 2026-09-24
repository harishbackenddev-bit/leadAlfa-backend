const { sequelize } = require("../config/database");
const { Op, QueryTypes } = require("sequelize");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const CampaignInvoice = require("../models/campaigns/campaignInvoice.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const Media = require("../models/media/media.model");
const { CAMPAIGN_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");
const { VALID_ADD_ON_KEYS } = require("../config/pricingConstants");
const { logCampaignActivity } = require("./campaignActivityService");
const { uploadCampaignMedia, deleteMediaData } = require("./mediaService");
const { syncInvoice, getInvoiceByCampaignId } = require("./invoiceService");
const AppError = require("../utils/appError");

const CAMPAIGN_MEDIA_MAPPING = [
  {
    field: "coverImage",
    usageType: CAMPAIGN_MEDIA_TYPES.COVER_IMAGE,
    mediaKey: "coverImage",
    multiple: false,
  },
  {
    field: "moodboards",
    usageType: CAMPAIGN_MEDIA_TYPES.MOODBOARDS,
    mediaKey: "moodboards",
    multiple: true,
  },
];

const sanitiseAddOns = (addOns) => {
  if (!Array.isArray(addOns)) return [];
  return addOns.filter((k) => VALID_ADD_ON_KEYS.includes(k));
};

const {
  enrichLinkRecord,
  enrichMediaRecord,
} = require("../utils/mediaDelivery");

const handleCampaignMediaUploads = async (
  userId,
  campaignId,
  files,
  transaction,
) => {
  const uploadedMedia = {};

  for (const {
    field,
    usageType,
    mediaKey,
    multiple,
  } of CAMPAIGN_MEDIA_MAPPING) {
    const fileArray = files[field];
    if (!fileArray || fileArray.length === 0) continue;

    const filesToProcess = multiple ? fileArray : [fileArray[0]];
    const mediaList = [];

    for (const file of filesToProcess) {
      const media = await uploadCampaignMedia(
        userId,
        campaignId,
        file,
        usageType,
        transaction,
      );
      mediaList.push(enrichMediaRecord(media));
    }

    uploadedMedia[mediaKey] = multiple ? mediaList : mediaList[0];
  }

  return uploadedMedia;
};

const campaignInclude = [
  {
    model: CampaignMedia,
    as: "mediaLinks",
    include: [{ model: Media, as: "mediaDetails" }],
    order: [["createdAt", "DESC"]],
  },
  {
    model: BrandProfile,
    as: "brand",
  },
  {
    model: CampaignInvoice,
    as: "invoice",
    required: false,
  },
];

const formatCampaignResponse = (json) => {
  const { mediaLinks, invoice, ...rest } = json;
  const enrichedMediaLinks = mediaLinks?.map(enrichLinkRecord) || [];

  const coverImage =
    enrichedMediaLinks.find(
      (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.COVER_IMAGE,
    ) || null;
  const moodboards =
    enrichedMediaLinks.filter(
      (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.MOODBOARDS,
    ) || [];

  let formattedInvoice = null;
  if (invoice) {
    const decimalFields = [
      "basePackagePrice",
      "basePackageTotal",
      "addOnsAmount",
      "cartSubtotal",
      "serviceFeeAmount",
      "amountBeforeTax",
      "vatAmount",
      "totalAmountDue",
    ];
    formattedInvoice = { ...invoice };
    decimalFields.forEach((f) => {
      if (formattedInvoice[f] != null)
        formattedInvoice[f] = parseFloat(formattedInvoice[f]);
    });
    formattedInvoice.creatorVisibleBudget =
      formattedInvoice.cartSubtotal ?? null;
  }

  return {
    ...rest,
    media: {
      coverImage: coverImage ? coverImage.mediaDetails : null,
      moodboards: moodboards.map((img) => img.mediaDetails),
    },
    invoice: formattedInvoice,
  };
};

const checkPresent = (obj, fields) =>
  fields.filter(
    (f) => obj[f] === null || obj[f] === undefined || obj[f] === "",
  );

const validateBasics = (c) =>
  checkPresent(c, [
    "campaignTitle",
    "deliverables",
    "platform",
    "productStatus",
    "compensationType",
  ]);

const validateAudience = (c) =>
  checkPresent(c, [
    "numberOfCreators",
    "ageRange",
    "gender",
    "followerCount",
    "engagementRate",
    "campaignBrief",
  ]);

const validateCreativeDirection = (c) => checkPresent(c, ["creativeDirection"]);

const validateMoodboard = (c, mediaCount) => {
  const hasUpload = mediaCount > 0;
  const hasUrl = !!c.moodboardInspirationUrl;
  return hasUpload || hasUrl ? [] : ["moodboardOrUrl"];
};

const validateCompensationFields = (c) => {
  if (c.compensationType === "Cash") return checkPresent(c, ["videoLength"]);
  if (c.compensationType === "Gift")
    return checkPresent(c, ["giftNameDescription"]);
  return [];
};

const validateCampaignCompleteness = (campaign, mediaCount = 0) => {
  const missing = [
    ...validateBasics(campaign),
    ...validateAudience(campaign),
    ...validateCreativeDirection(campaign),
    ...validateMoodboard(campaign, mediaCount),
    ...validateCompensationFields(campaign),
  ];

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missingFields: missing };
};

const createCampaign = async (userId, brandId, campaignData, files) => {
  const transaction = await sequelize.transaction();

  try {
    if (campaignData.addOns)
      campaignData.addOns = sanitiseAddOns(campaignData.addOns);

    const campaign = await Campaign.create(
      { ...campaignData, brandId, status: "inactive" },
      { transaction },
    );

    await handleCampaignMediaUploads(userId, campaign.id, files, transaction);

    await syncInvoice(campaign, transaction);

    await transaction.commit();

    const full = await getCampaignById(campaign.publicId);
    return full;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const updateCampaign = async (userId, brandId, publicId, updates, files) => {
  const transaction = await sequelize.transaction();

  try {
    const campaign = await Campaign.findOne({
      where: { publicId, isDeleted: false },
      include: [{ model: CampaignInvoice, as: "invoice", required: false }],
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found.", 404);
    if (campaign.brandId !== brandId) throw new AppError("Unauthorized.", 403);

    if (campaign.status === "active") {
      throw new AppError("Published campaigns cannot be edited.", 403);
    }

    // ✅ Sirf campaign funding status check karo — invoice mat dekho
    const blockedFundingStatuses = ['FUNDS_RECEIVED', 'FUNDED'];
    if (blockedFundingStatuses.includes(campaign.fundingStatus)) {
      throw new AppError(
        "This campaign has already been funded and cannot be edited.",
        423,
      );
    }

    const cleanUpdates = { ...updates };
    if (cleanUpdates.addOns)
      cleanUpdates.addOns = sanitiseAddOns(cleanUpdates.addOns);

    await campaign.update(cleanUpdates, { transaction });

    if (files && Object.keys(files).length > 0) {
      for (const { field, usageType } of CAMPAIGN_MEDIA_MAPPING) {
        if (files[field]?.length > 0) {
          const existingLinks = await CampaignMedia.findAll({
            where: { campaignId: campaign.id, usageType },
            attributes: ["mediaId"],
            transaction,
          });
          if (existingLinks.length > 0) {
            await deleteMediaData(
              existingLinks.map((l) => l.mediaId),
              transaction,
            );
          }
        }
      }
      await handleCampaignMediaUploads(userId, campaign.id, files, transaction);
    }

    await syncInvoice(campaign, transaction);

    await transaction.commit();

    return getCampaignById(publicId);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const submitForPayment = async (userId, brandId, publicId) => {
  const transaction = await sequelize.transaction();

  try {
    const campaign = await Campaign.findOne({
      where: { publicId, isDeleted: false },
      include: [{ model: CampaignInvoice, as: "invoice", required: false }],
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found.", 404);
    if (campaign.brandId !== brandId) throw new AppError("Unauthorized.", 403);

    if (campaign.compensationType !== "Cash") {
      throw new AppError(
        "Payment submission is only applicable to Cash campaigns.",
        400,
      );
    }

    if (campaign.status !== "inactive") {
      throw new AppError(
        "Only draft campaigns can be submitted for payment.",
        400,
      );
    }

    const mediaCount = await CampaignMedia.count({
      where: { campaignId: campaign.id },
      transaction,
    });
    const { valid, missingFields } = validateCampaignCompleteness(
      campaign.toJSON(),
      mediaCount,
    );
    if (!valid) {
      throw new AppError(
        `Campaign is incomplete. Missing required fields: ${missingFields.join(", ")}.`,
        400,
      );
    }

    const invoice = campaign.invoice;
    if (!invoice) {
      throw new AppError(
        "Invoice has not been generated yet. Ensure videoLength is set and save the campaign first.",
        400,
      );
    }

    if (invoice.paymentStatus === "paid") {
      throw new AppError("This campaign has already been paid for.", 409);
    }

    if (invoice.paymentStatus === "pending") {
      throw new AppError(
        "A payment is already in progress for this campaign.",
        409,
      );
    }

    const { lockInvoice } = require("./invoiceService");
    await lockInvoice(invoice.id, invoice.publicId, transaction);

    await transaction.commit();

    return {
      campaignPublicId: campaign.publicId,
      invoicePublicId: invoice.publicId,
      totalAmountDue: parseFloat(invoice.totalAmountDue),
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const publishCampaign = async (campaignId, transaction) => {
  const campaign = await Campaign.findByPk(campaignId, { transaction });
  if (!campaign) throw new AppError("Campaign not found.", 404);

  if (campaign.status === "active") return campaign;

  if (campaign.status !== "inactive") {
    throw new AppError(
      `Cannot publish a campaign in '${campaign.status}' state.`,
      409,
    );
  }

  await campaign.update({ status: "active" }, { transaction });

  logCampaignActivity({
    campaignId: campaign.id,
    actorType: "system",
    actorId: null,
    eventType: ACTIVITY_EVENT_TYPES.CAMPAIGN_CREATED,
    metadata: {
      campaignPublicId: campaign.publicId,
      campaignTitle: campaign.campaignTitle,
    },
  });

  return campaign;
};

const getCampaignById = async (publicId) => {
  const campaign = await Campaign.findOne({
    where: { publicId, isDeleted: false },
    include: campaignInclude,
  });

  if (!campaign) return null;

  const json = campaign.toJSON();
  const applicationCount = await CampaignApplication.count({
    where: { campaignId: campaign.id },
  });

  return {
    ...formatCampaignResponse(json),
    hasApplications: applicationCount > 0,
  };
};

const getBrandDrafts = async (brandId, page = 1, limit = 10) => {
  const brand = await BrandProfile.findByPk(brandId);
  if (!brand) throw new AppError("Brand not found.", 404);

  const limitValue = parseInt(limit, 10);
  const offset = (parseInt(page, 10) - 1) * limitValue;

  const { count, rows: campaigns } = await Campaign.findAndCountAll({
    where: { brandId, status: "inactive", isDeleted: false },
    limit: limitValue,
    offset,
    distinct: true,
    include: [
      {
        model: CampaignMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
      },
      {
        model: CampaignInvoice,
        as: "invoice",
        required: false,
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  const formattedCampaigns = campaigns.map((c) =>
    formatCampaignResponse(c.toJSON()),
  );

  return {
    campaigns: formattedCampaigns,
    pagination: {
      totalItems: count,
      totalPages: Math.ceil(count / limitValue),
      currentPage: parseInt(page, 10),
    },
  };
};

const getCampaignsByBrand = async (brandId, status, page = 1, limit = 10) => {
  const brand = await BrandProfile.findByPk(brandId);
  if (!brand) throw new AppError("Brand not found.", 404);

  const where = { brandId, isDeleted: false };
  if (status) where.status = status;

  const limitValue = parseInt(limit, 10);
  const offset = (parseInt(page, 10) - 1) * limitValue;

  const { count, rows: campaigns } = await Campaign.findAndCountAll({
    where,
    limit: limitValue,
    offset,
    distinct: true,
    include: [
      {
        model: CampaignMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
      },
      {
        model: CampaignInvoice,
        as: "invoice",
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  const campaignIds = campaigns.map((c) => c.id);
  let statsMap = {};

  if (campaignIds.length > 0) {
    const statsRows = await sequelize.query(
      `SELECT
         c.id                                                          AS "campaignId",
         COUNT(DISTINCT ca.id)::int                                    AS "totalApplications",
         COUNT(DISTINCT ci.id)::int                                    AS "totalInvitations",
         COUNT(DISTINCT cj.id)::int                                    AS "hiredCreators",
         COUNT(DISTINCT ws.id)::int                                    AS "totalSubmissions",
         SUM(CASE WHEN latest_sr.status = 'pending_review'      THEN 1 ELSE 0 END)::int AS "pendingReview",
         SUM(CASE WHEN latest_sr.status = 'approved'            THEN 1 ELSE 0 END)::int AS "approvedSubmissions",
         SUM(CASE WHEN latest_sr.status = 'revision_requested'  THEN 1 ELSE 0 END)::int AS "revisionRequested",
         SUM(CASE WHEN latest_sr.status = 'rejected'            THEN 1 ELSE 0 END)::int AS "rejectedSubmissions"
       FROM "Campaigns" c
       LEFT JOIN "CampaignApplications" ca  ON ca."campaignId"  = c.id
       LEFT JOIN "CampaignInvitations"  ci  ON ci."campaignId"  = c.id
       LEFT JOIN "CreatorJobs"          cj  ON cj."campaignId"  = c.id
       LEFT JOIN "WorkSubmissions"      ws  ON ws."jobId"        = cj.id
       LEFT JOIN "SubmissionRevisions" latest_sr
         ON latest_sr.id = (
           SELECT id FROM "SubmissionRevisions" sr_inner
           WHERE sr_inner."submissionId" = ws.id
           ORDER BY sr_inner."revisionNumber" DESC
           LIMIT 1
         )
       WHERE c.id IN (:campaignIds)
       GROUP BY c.id`,
      { replacements: { campaignIds }, type: QueryTypes.SELECT },
    );

    statsMap = statsRows.reduce((acc, row) => {
      acc[row.campaignId] = {
        totalApplications: row.totalApplications,
        totalInvitations: row.totalInvitations,
        hiredCreators: row.hiredCreators,
        totalSubmissions: row.totalSubmissions,
        pendingReview: row.pendingReview,
        approvedSubmissions: row.approvedSubmissions,
        revisionRequested: row.revisionRequested,
        rejectedSubmissions: row.rejectedSubmissions,
      };
      return acc;
    }, {});
  }

  const formattedCampaigns = campaigns.map((campaign) => {
    const formatted = formatCampaignResponse(campaign.toJSON());
    const stats = statsMap[campaign.id] || {
      totalApplications: 0,
      totalInvitations: 0,
      hiredCreators: 0,
      totalSubmissions: 0,
      pendingReview: 0,
      approvedSubmissions: 0,
      revisionRequested: 0,
      rejectedSubmissions: 0,
    };
    return { ...formatted, stats };
  });

  return {
    brand,
    campaigns: formattedCampaigns,
    pagination: {
      totalItems: count,
      totalPages: Math.ceil(count / limitValue),
      currentPage: parseInt(page, 10),
    },
  };
};

const getPublicActiveCampaigns = async (page = 1, limit = 10) => {
  const limitValue = parseInt(limit, 10);
  const offset = (parseInt(page, 10) - 1) * limitValue;

  const { count, rows: campaigns } = await Campaign.findAndCountAll({
    where: { status: "active", isDeleted: false },
    limit: limitValue,
    offset,
    distinct: true,
    include: [
      {
        model: CampaignMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
      },
      {
        model: BrandProfile,
        as: "brand",
      },
      {
        model: CampaignInvoice,
        as: "invoice",
        required: false,
        attributes: ["cartSubtotal", "paymentStatus"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  const formattedCampaigns = campaigns.map((campaign) => {
    const json = campaign.toJSON();
    const { mediaLinks, invoice, ...rest } = json;

    const coverImage =
      mediaLinks?.find(
        (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.COVER_IMAGE,
      ) || null;
    const moodboards =
      mediaLinks?.filter(
        (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.MOODBOARDS,
      ) || [];

    // ✅ Sirf ye calculate karo
    const creatorAmount =
      invoice?.cartSubtotal && campaign.numberOfCreators
        ? parseFloat(invoice.cartSubtotal) / campaign.numberOfCreators
        : null;

    return {
      ...rest,
      media: {
        coverImage: coverImage ? coverImage.mediaDetails : null,
        moodboards: moodboards.map((img) => img.mediaDetails),
      },
      creatorVisibleBudget: invoice?.cartSubtotal
        ? parseFloat(invoice.cartSubtotal)
        : null,
      // ✅ Sirf ye 1 line add hui
      creatorAmount,
    };
  });

  return {
    campaigns: formattedCampaigns,
    pagination: {
      totalItems: count,
      totalPages: Math.ceil(count / limitValue),
      currentPage: parseInt(page, 10),
    },
  };
};

const deleteDraftCampaign = async (publicId, brandId) => {
  const campaign = await Campaign.findOne({
    where: { publicId, isDeleted: false },
    include: [{ model: CampaignInvoice, as: "invoice", required: false }],
  });
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.brandId !== brandId) throw new AppError("Unauthorized.", 403);

  if (campaign.status !== "inactive") {
    throw new AppError("Only draft campaigns can be deleted.", 403);
  }

  if (campaign.invoice?.paymentStatus === "pending") {
    throw new AppError(
      "Cannot delete this campaign while a payment is being processed. Please wait for the payment to resolve.",
      423,
    );
  }

  if (campaign.invoice?.paymentStatus === "paid") {
    throw new AppError(
      "Cannot delete a campaign that has already been paid for.",
      403,
    );
  }

  await campaign.update({ isDeleted: true });
  return true;
};

const getInvoiceForCampaign = async (publicId, brandId) => {
  const campaign = await Campaign.findOne({
    where: { publicId, isDeleted: false },
  });
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.brandId !== brandId) throw new AppError("Unauthorized.", 403);

  return getInvoiceByCampaignId(campaign.id);
};

module.exports = {
  createCampaign,
  updateCampaign,
  submitForPayment,
  publishCampaign,
  getCampaignById,
  getBrandDrafts,
  getCampaignsByBrand,
  getPublicActiveCampaigns,
  deleteDraftCampaign,
  getInvoiceForCampaign,
  validateCampaignCompleteness,
};
