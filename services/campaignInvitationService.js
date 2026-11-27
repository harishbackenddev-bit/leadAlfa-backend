const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const crypto = require("crypto");
const Campaign = require("../models/campaigns/campaign.model");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const CreatorJob = require("../models/jobs/creatorJob.model");
const CampaignInvitation = require("../models/campaigns/campaignInvitation.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const Media = require("../models/media/media.model");
const AppError = require("../utils/appError");
const { BRAND_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");
const { logCampaignActivity } = require("./campaignActivityService");

const INVITATION_STATUSES = ["pending", "accepted", "declined"];

/**
 * Format a brand-view invitation card
 */
const formatBrandInvitation = (invInstance) => {
  const json = invInstance.toJSON();
  const creator = json.creator || null;
  const campaign = json.campaign || null;

  return {
    invitationId: json.publicId,
    status: json.status,
    customMessage: json.customMessage,
    createdAt: json.createdAt,
    creator: creator
      ? {
          id: creator.id,
          firstName: creator.firstName,
          lastName: creator.lastName,
        }
      : null,
    campaign: campaign
      ? {
          id: campaign.id,
          publicId: campaign.publicId,
          title: campaign.campaignTitle,
          compensationType: campaign.compensationType,
          videoLength: campaign.videoLength,
          numberOfCreators: campaign.numberOfCreators,
          giftNameDescription: campaign.giftNameDescription,
        }
      : null,
  };
};

/**
 * Format a creator-view invitation card
 */
const formatCreatorInvitation = (invInstance) => {
  const json = invInstance.toJSON();
  const campaign = json.campaign || null;
  const brand = campaign?.brand || null;

  const brandMediaLinks = brand?.mediaLinks || [];
  const logoLink = brandMediaLinks.find(
    (m) => m.usageType === BRAND_MEDIA_TYPES.LOGO
  );

  return {
    invitationId: json.publicId,
    status: json.status,
    customMessage: json.customMessage,
    createdAt: json.createdAt,
    brand: brand
      ? {
          id: brand.id,
          name: brand.companyName,
          logo: logoLink ? logoLink.mediaDetails : null,
        }
      : null,
    campaign: campaign
      ? {
          id: campaign.id,
          publicId: campaign.publicId,
          title: campaign.campaignTitle,
          campaignBrief: campaign.campaignBrief,
          compensationType: campaign.compensationType,
          videoLength: campaign.videoLength,
          numberOfCreators: campaign.numberOfCreators,
          giftNameDescription: campaign.giftNameDescription,
          deliverables: campaign.deliverables,
          platform: campaign.platform,
        }
      : null,
  };
};

/**
 * Send campaign invitations to multiple creators (Bulk)
 */
const sendInvitations = async (brandId, campaignId, creatorIds, customMessage) => {
  if (!creatorIds || !Array.isArray(creatorIds) || creatorIds.length === 0) {
    throw new AppError("A non-empty list of creatorIds is required.", 400);
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Verify Campaign belongs to brand and is active/not deleted
    const campaign = await Campaign.findOne({
      where: {
        id: campaignId,
        brandId,
        status: "active",
        isDeleted: false,
      },
      transaction,
    });

    if (!campaign) {
      throw new AppError(
        "Campaign not found, is inactive, or you do not have permission to invite creators to it.",
        404
      );
    }

    // 2. Validate all creators exist, are approved, and not deleted
    const creators = await CreatorProfile.findAll({
      where: {
        id: { [Op.in]: creatorIds },
        status: "approved",
        isDeleted: false,
      },
      transaction,
    });

    if (creators.length !== creatorIds.length) {
      const foundIds = creators.map((c) => c.id);
      const invalidIds = creatorIds.filter((id) => !foundIds.includes(id));
      throw new AppError(
        `Invalid or unapproved creator IDs: ${invalidIds.join(", ")}`,
        400
      );
    }

    const createdList = [];

    // 3. Check for duplicates and invite in a loop
    for (const creatorId of creatorIds) {
      // Check existing invitation
      const existingInvitation = await CampaignInvitation.findOne({
        where: { campaignId, creatorId },
        transaction,
      });

      if (existingInvitation) {
        throw new AppError(
          `Creator with ID ${creatorId} has already been invited to this campaign.`,
          400
        );
      }

      // Check existing application
      const existingApplication = await CampaignApplication.findOne({
        where: { campaignId, creatorId },
        transaction,
      });

      if (existingApplication) {
        throw new AppError(
          `Creator with ID ${creatorId} has already applied to this campaign.`,
          400
        );
      }

      // Check existing job
      const existingJob = await CreatorJob.findOne({
        where: { campaignId, creatorId },
        transaction,
      });

      if (existingJob) {
        throw new AppError(
          `Creator with ID ${creatorId} is already hired/working on this campaign.`,
          400
        );
      }
    }

    // 4. Bulk create
    const invitationsData = creatorIds.map((creatorId) => ({
      campaignId,
      creatorId,
      customMessage,
      status: "pending",
      publicId: `INV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    }));

    const invitations = await CampaignInvitation.bulkCreate(invitationsData, {
      transaction,
      individualHooks: true,
    });

    await transaction.commit();

    for (const inv of invitations) {
      logCampaignActivity({
        campaignId,
        actorType: "brand",
        actorId: brandId,
        eventType: ACTIVITY_EVENT_TYPES.INVITATION_SENT,
        metadata: {
          invitationPublicId: inv.publicId,
          creatorId: inv.creatorId,
        },
      });
    }

    return invitations.map((inv) => ({
      invitationId: inv.publicId,
      creatorId: inv.creatorId,
    }));
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * List Sent Brand Invitations
 */
const getBrandInvitations = async (brandId, { campaignId, status, page = 1, limit = 10 } = {}) => {
  if (status && !INVITATION_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status filter. Must be one of: ${INVITATION_STATUSES.join(", ")}`,
      400
    );
  }

  const limitValue = parseInt(limit, 10);
  const pageValue = parseInt(page, 10);
  const offset = (pageValue - 1) * limitValue;

  const where = {};
  if (status) where.status = status;
  if (campaignId) where.campaignId = campaignId;

  const { count, rows } = await CampaignInvitation.findAndCountAll({
    where,
    limit: limitValue,
    offset,
    distinct: true,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Campaign,
        as: "campaign",
        where: { brandId },
        required: true,
        attributes: [
          "id",
          "publicId",
          "campaignTitle",
          "compensationType",
          "videoLength",
          "numberOfCreators",
          "giftNameDescription",
        ],
      },
      {
        model: CreatorProfile,
        as: "creator",
        required: true,
        attributes: ["id", "firstName", "lastName"],
      },
    ],
  });

  const invitations = rows.map(formatBrandInvitation);

  return {
    invitations,
    pagination: {
      totalItems: count,
      totalPages: limitValue > 0 ? Math.ceil(count / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};

/**
 * Withdraw a pending invitation (delete)
 */
const withdrawInvitation = async (brandId, publicId) => {
  const invitation = await CampaignInvitation.findOne({
    where: { publicId },
    include: [
      {
        model: Campaign,
        as: "campaign",
        attributes: ["brandId"],
      },
    ],
  });

  if (!invitation) {
    throw new AppError("Invitation not found.", 404);
  }

  if (invitation.campaign.brandId !== brandId) {
    throw new AppError("Permission denied: You do not own this campaign.", 403);
  }

  if (invitation.status !== "pending") {
    throw new AppError(
      "Only pending invitations can be withdrawn.",
      400
    );
  }

  await invitation.destroy();
  return { success: true };
};

/**
 * List Creator Received Invitations
 */
const getCreatorInvitations = async (creatorId, { status, page = 1, limit = 10 } = {}) => {
  if (status && !INVITATION_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status filter. Must be one of: ${INVITATION_STATUSES.join(", ")}`,
      400
    );
  }

  const limitValue = parseInt(limit, 10);
  const pageValue = parseInt(page, 10);
  const offset = (pageValue - 1) * limitValue;

  const where = { creatorId };
  if (status) where.status = status;

  const { count, rows } = await CampaignInvitation.findAndCountAll({
    where,
    limit: limitValue,
    offset,
    distinct: true,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Campaign,
        as: "campaign",
        required: true,
        attributes: [
          "id",
          "publicId",
          "campaignTitle",
          "campaignBrief",
          "compensationType",
          "videoLength",
          "numberOfCreators",
          "giftNameDescription",
          "deliverables",
          "platform",
        ],
        include: [
          {
            model: BrandProfile,
            as: "brand",
            required: true,
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
        ],
      },
    ],
  });

  const invitations = rows.map(formatCreatorInvitation);

  return {
    invitations,
    pagination: {
      totalItems: count,
      totalPages: limitValue > 0 ? Math.ceil(count / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};

/**
 * Get Invitation Details
 */
const getInvitationDetails = async (creatorId, publicId) => {
  const invitation = await CampaignInvitation.findOne({
    where: { publicId, creatorId },
    include: [
      {
        model: Campaign,
        as: "campaign",
        required: true,
        attributes: [
          "id",
          "publicId",
          "campaignTitle",
          "campaignBrief",
          "compensationType",
          "videoLength",
          "numberOfCreators",
          "giftNameDescription",
          "deliverables",
          "platform",
        ],
        include: [
          {
            model: BrandProfile,
            as: "brand",
            required: true,
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
        ],
      },
    ],
  });

  if (!invitation) {
    throw new AppError("Invitation not found.", 404);
  }

  return formatCreatorInvitation(invitation);
};

/**
 * Accept Invitation
 */
const acceptInvitation = async (creatorId, publicId) => {
  const invitation = await CampaignInvitation.findOne({
    where: { publicId, creatorId },
  });

  if (!invitation) {
    throw new AppError("Invitation not found.", 404);
  }

  if (invitation.status !== "pending") {
    throw new AppError(
      `Cannot accept invitation. Current status is '${invitation.status}'.`,
      400
    );
  }

  await invitation.update({ status: "accepted" });

  const campaign = await Campaign.findByPk(invitation.campaignId, {
    attributes: ["id", "publicId"],
  });

  logCampaignActivity({
    campaignId: invitation.campaignId,
    actorType: "creator",
    actorId: creatorId,
    eventType: ACTIVITY_EVENT_TYPES.INVITATION_ACCEPTED,
    metadata: {
      invitationPublicId: invitation.publicId,
    },
  });

  return {
    invitationId: invitation.publicId,
    status: "accepted",
    campaignPublicId: campaign?.publicId || null,
  };
};

/**
 * Decline Invitation
 */
const declineInvitation = async (creatorId, publicId) => {
  const invitation = await CampaignInvitation.findOne({
    where: { publicId, creatorId },
  });

  if (!invitation) {
    throw new AppError("Invitation not found.", 404);
  }

  if (invitation.status !== "pending") {
    throw new AppError(
      `Cannot decline invitation. Current status is '${invitation.status}'.`,
      400
    );
  }

  await invitation.update({ status: "declined" });

  logCampaignActivity({
    campaignId: invitation.campaignId,
    actorType: "creator",
    actorId: creatorId,
    eventType: ACTIVITY_EVENT_TYPES.INVITATION_DECLINED,
    metadata: {
      invitationPublicId: invitation.publicId,
    },
  });

  return {
    invitationId: invitation.publicId,
    status: "declined",
  };
};

module.exports = {
  sendInvitations,
  getBrandInvitations,
  withdrawInvitation,
  getCreatorInvitations,
  getInvitationDetails,
  acceptInvitation,
  declineInvitation,
  INVITATION_STATUSES,
};
