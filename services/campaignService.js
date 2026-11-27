const { sequelize } = require("../config/database");
const { Op, QueryTypes } = require("sequelize");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const CampaignInvoice = require("../models/campaigns/campaignInvoice.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const Media = require("../models/media/media.model");
const FundingBatch = require("../models/transaction/fundingBatch.model");
const { CAMPAIGN_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");
const { VALID_ADD_ON_KEYS } = require("../config/pricingConstants");
const { logCampaignActivity } = require("./campaignActivityService");
const { uploadCampaignMedia, deleteMediaData } = require("./mediaService");
const { syncInvoice, getInvoiceByCampaignId } = require("./invoiceService");
const AppError = require("../utils/appError");
const {
  pickEditableFields,
  isPaidCampaign,
  findChangedPricingFields,
  describePricingFields,
  PRICING_FIELDS,
} = require("./campaignEditPolicy");

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

/**
 * Fields of the invoice that must never leave the server
 * (raw TradeSafe payload etc.).
 */
const INVOICE_PRIVATE_FIELDS = ["gatewayPayload"];

/**
 * Only the owning brand may see the full invoice (platform fee, VAT, total).
 * Everybody else (creators, other brands) only gets what creators are allowed
 * to see: the campaign budget.
 */
const INVOICE_PUBLIC_FIELDS = [
  "cartSubtotal",
  "creatorVisibleBudget",
  "paymentStatus",
  "videoLength",
  "numberOfCreators",
];

const formatCampaignResponse = (json, { includeFullInvoice = true } = {}) => {
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
    INVOICE_PRIVATE_FIELDS.forEach((f) => delete formattedInvoice[f]);
    decimalFields.forEach((f) => {
      if (formattedInvoice[f] != null)
        formattedInvoice[f] = parseFloat(formattedInvoice[f]);
    });
    formattedInvoice.creatorVisibleBudget =
      formattedInvoice.cartSubtotal ?? null;

    if (!includeFullInvoice) {
      const limited = {};
      INVOICE_PUBLIC_FIELDS.forEach((f) => {
        if (formattedInvoice[f] !== undefined) limited[f] = formattedInvoice[f];
      });
      formattedInvoice = limited;
    }
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

/**
 * A payment link may already be open for a draft (fundingStatus AWAITING_FUNDING).
 * If the brand changes the price after that, or deletes the draft, the open
 * link must stop activating the campaign: mark the pending batch failed and
 * move the campaign back to UNFUNDED so a fresh quote/link is generated.
 */
const cancelOpenFunding = async (campaign, transaction) => {
  await FundingBatch.update(
    { status: "FUNDING_FAILED" },
    {
      where: {
        campaignId: campaign.id,
        type: "CAMPAIGN_FUNDING",
        status: "PENDING_PAYMENT",
      },
      transaction,
    },
  );
};

const createCampaign = async (userId, brandId, campaignData, files) => {
  const transaction = await sequelize.transaction();

  try {
    // Whitelist: a brand must never be able to set status / fundingStatus /
    // budget columns from the request body.
    const safeData = pickEditableFields(campaignData);
    if (safeData.addOns) safeData.addOns = sanitiseAddOns(safeData.addOns);

    const campaign = await Campaign.create(
      { ...safeData, brandId, status: "inactive" },
      { transaction },
    );

    await handleCampaignMediaUploads(userId, campaign.id, files, transaction);

    await syncInvoice(campaign, transaction);

    await transaction.commit();

    const full = await getCampaignById(campaign.publicId, {
      viewerBrandId: brandId,
    });
    return full;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Update a campaign.
 *
 *  - Draft (inactive):  everything is editable; invoice is re-priced.
 *  - Published (active / paid): everything EXCEPT the pricing fields is
 *    editable. NO new payment is requested.
 *  - Closed: read-only.
 */
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

    if (campaign.status === "closed") {
      throw new AppError("Closed campaigns cannot be edited.", 403);
    }

    const cleanUpdates = pickEditableFields(updates);
    if (cleanUpdates.addOns)
      cleanUpdates.addOns = sanitiseAddOns(cleanUpdates.addOns);

    const paid = isPaidCampaign(campaign, campaign.invoice);
    const changedPricing = findChangedPricingFields(campaign, cleanUpdates);

    if (paid) {
      if (changedPricing.length > 0) {
        throw new AppError(
          `${describePricingFields(changedPricing)} cannot be changed after the campaign has been paid for. ` +
            "All other details can still be updated.",
          409,
        );
      }
      // Unchanged pricing fields are dropped so the paid invoice is never touched.
      PRICING_FIELDS.forEach((f) => delete cleanUpdates[f]);
    } else if (
      campaign.fundingStatus === "AWAITING_FUNDING" &&
      changedPricing.length > 0
    ) {
      // Price changed while a payment link was open -> that link is now stale.
      await cancelOpenFunding(campaign, transaction);
      cleanUpdates.fundingStatus = "UNFUNDED";
      cleanUpdates.campaignBudgetCents = 0;
    }

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

    // syncInvoice() leaves a paid invoice untouched.
    await syncInvoice(campaign, transaction);

    await transaction.commit();

    return getCampaignById(publicId, { viewerBrandId: brandId });
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Validates that a draft is complete and returns what the brand has to pay.
 * It does NOT lock the invoice any more: the invoice only becomes "paid" when
 * TradeSafe confirms the deposit (see confirmCampaignFunded). Locking here
 * left drafts stuck in "pending" forever when the brand closed the payment tab.
 */
const submitForPayment = async (userId, brandId, publicId) => {
  const campaign = await Campaign.findOne({
    where: { publicId, isDeleted: false },
    include: [{ model: CampaignInvoice, as: "invoice", required: false }],
  });
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.brandId !== brandId) throw new AppError("Unauthorized.", 403);

  if (campaign.compensationType !== "Cash") {
    throw new AppError(
      "Payment submission is only applicable to Cash campaigns.",
      400,
    );
  }

  if (isPaidCampaign(campaign, campaign.invoice)) {
    throw new AppError(
      "This campaign has already been paid for and published.",
      409,
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

  return {
    campaignPublicId: campaign.publicId,
    invoicePublicId: invoice.publicId,
    totalAmountDue: parseFloat(invoice.totalAmountDue),
  };
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

const getCampaignById = async (publicId, { viewerBrandId = null } = {}) => {
  const campaign = await Campaign.findOne({
    where: { publicId, isDeleted: false },
    include: campaignInclude,
  });

  if (!campaign) return null;

  const json = campaign.toJSON();
  const applicationCount = await CampaignApplication.count({
    where: { campaignId: campaign.id },
  });

  const isOwner =
    viewerBrandId !== null &&
    viewerBrandId !== undefined &&
    campaign.brandId === viewerBrandId;

  return {
    ...formatCampaignResponse(json, { includeFullInvoice: isOwner }),
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

  if (isPaidCampaign(campaign, campaign.invoice)) {
    throw new AppError(
      "Cannot delete a campaign that has already been paid for.",
      403,
    );
  }

  const transaction = await sequelize.transaction();
  try {
    // An open payment link must not be able to activate a deleted campaign.
    await cancelOpenFunding(campaign, transaction);
    await campaign.update(
      { isDeleted: true, fundingStatus: "UNFUNDED", campaignBudgetCents: 0 },
      { transaction },
    );
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
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
