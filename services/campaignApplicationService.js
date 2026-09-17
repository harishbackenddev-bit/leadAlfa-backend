const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const CampaignApplicationMedia = require("../models/campaigns/campaignApplicationMedia.model");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const Media = require("../models/media/media.model");
const CreatorJob = require("../models/jobs/creatorJob.model");
const { findOrCreateCampaignChatRoom } = require("../services/chatRoomService");
const { createJobFromApplication } = require("./creatorJobService");
const CampaignInvitation = require("../models/campaigns/campaignInvitation.model");
const AppError = require("../utils/appError");
const {
  BRAND_MEDIA_TYPES,
  CAMPAIGN_APPLICATION_MEDIA_TYPES,
} = require("../config/mediaUsageTypes");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");
const { logCampaignActivity } = require("./campaignActivityService");
const {
  deleteMediaData,
  linkMediaToEntity,
} = require("./mediaService");


const applyToCampaign = async (
  userId,
  campaignId,
  creatorId,
  applicationData
) => {
  const transaction = await sequelize.transaction();

  try {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign || campaign.status !== "active") {
      throw new AppError(
        "Campaign not found or not currently active for applications",
        400
      );
    }

    // Check if there is an active invitation for this creator and campaign
    const invitation = await CampaignInvitation.findOne({
      where: {
        campaignId,
        creatorId,
        status: { [Op.in]: ["pending", "accepted"] },
      },
      transaction,
    });

    const invitationId = invitation ? invitation.id : null;

    const application = await CampaignApplication.create(
      {
        campaignId,
        creatorId,
        pitch: applicationData.pitch,
        applicationStatus: "pending",
        invitationId,
      },
      { transaction }
    );

    if (invitation) {
      await invitation.update(
        { status: "accepted" },
        { transaction }
      );
    }

    const mediaId = parseInt(applicationData.mediaId, 10);
    const mediaRecord = await Media.findByPk(mediaId, { transaction });
    if (!mediaRecord) {
      throw new AppError(
        "The provided mediaId does not exist. Please register your upload first.",
        400
      );
    }

    await linkMediaToEntity(
      "campaignApplication",
      application.id,
      mediaId,
      CAMPAIGN_APPLICATION_MEDIA_TYPES.VIDEO_PITCH,
      transaction
    );

    const uploadedMedia = { pitchVideo: mediaRecord };

    await transaction.commit();

    logCampaignActivity({
      campaignId: campaign.id,
      actorType: "creator",
      actorId: creatorId,
      eventType: ACTIVITY_EVENT_TYPES.APPLICATION_RECEIVED,
      metadata: {
        applicationId: application.id,
        campaignPublicId: campaign.publicId,
      },
    });

    const appJson = application.toJSON();
    delete appJson.proposedBudget;

    return { application: appJson, media: uploadedMedia };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const withdrawApplication = async (creatorId, applicationId) => {
  const transaction = await sequelize.transaction();

  try {
    const application = await CampaignApplication.findOne({
      where: {
        id: applicationId,
        creatorId: creatorId,
        applicationStatus: { [Op.in]: ["pending", "rejected"] },
      },
      include: [
        {
          model: CampaignApplicationMedia,
          as: "applicationMedia",
          attributes: ["mediaId"],
        },
      ],
      transaction,
    });

    if (!application) {
      throw new AppError(
        "Application not found, or it is already accepted/withdrawn.",
        400
      );
    }

    const mediaIdsToDelete = application.applicationMedia.map((m) => m.mediaId);

    if (mediaIdsToDelete.length > 0) {
      await deleteMediaData(mediaIdsToDelete, transaction);
    }

    await application.destroy({ transaction });

    await transaction.commit();
    return { success: true };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const getCreatorApplications = async (creatorId) => {
  const { literal } = require("sequelize");

  const applications = await CampaignApplication.findAll({
    where: {
      creatorId,
      [Op.or]: [
        { applicationStatus: { [Op.ne]: "accepted" } },
        literal(
          `("CampaignApplication"."applicationStatus" = 'accepted' AND EXISTS ` +
          `(SELECT 1 FROM "CreatorJobs" cj WHERE cj."applicationId" = "CampaignApplication"."id"))`
        ),
      ],
    },
    attributes: [
      "id",
      "applicationStatus",
      "pitch",
      "createdAt",
    ],
    include: [
      {
        model: Campaign,
        as: "campaign",
        attributes: [
          "id",
          "campaignTitle",
          "campaignBrief",
          "deliverables",
          "platform",
          "status",
          "compensationType",
          "videoLength",
          "numberOfCreators",
          "giftNameDescription",
        ],
        include: [
          {
            model: BrandProfile,
            as: "brand",
            include: [
              {
                model: BrandMedia,
                as: "mediaLinks",
                attributes: ["usageType"],
                include: [{ model: Media, as: "mediaDetails" }],
              },
            ],
          },
          {
            model: CampaignMedia,
            as: "mediaLinks",
            include: [{ model: Media, as: "mediaDetails" }],
          },
        ],
      },
      {
        model: CampaignApplicationMedia,
        as: "applicationMedia",
        include: [{ model: Media, as: "mediaDetails" }],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return applications.map((app) => {
    const json = app.toJSON();

    const brandMediaLinks = json.campaign.brand.mediaLinks || [];
    const brandLogo = brandMediaLinks.find(
      (m) => m.usageType === BRAND_MEDIA_TYPES.LOGO
    );
    const { mediaLinks: brandMediaLinksCleaned, ...brandRest } =
      json.campaign.brand;

    const campaignMediaLinks = json.campaign.mediaLinks || [];
    const campaignMedia = {
      productImages: campaignMediaLinks
        .filter((m) => m.usageType === CAMPAIGN_MEDIA_TYPES.PRODUCT_IMAGE)
        .map((m) => m.mediaDetails),
      moodboards:
        campaignMediaLinks.find(
          (m) => m.usageType === CAMPAIGN_MEDIA_TYPES.MOODBOARDS
        )?.mediaDetails || null,
    };

    const {
      mediaLinks: campaignMediaLinksCleaned,
      brand,
      ...campaignRest
    } = json.campaign;

    const applicationPitchMedia = (json.applicationMedia || []).map((m) => ({
      ...m.mediaDetails,
      usageType: m.usageType,
    }));

    const { applicationMedia, ...applicationRest } = json;

    return {
      ...applicationRest,
      campaign: {
        ...campaignRest,
        media: campaignMedia,
        brand: {
          ...brandRest,
          logo: brandLogo ? brandLogo.mediaDetails : null,
        },
      },
      applicationMedia: applicationPitchMedia,
    };
  });
};

const { enrichMediaRecord, enrichLinkRecord } = require("../utils/mediaDelivery");

const viewApplicants = async (campaignId, brandId, statusFilter) => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, brandId },
  });

  if (!campaign) {
    throw new AppError(
      "Campaign not found or does not belong to this brand.",
      403
    );
  }

  const whereCondition = { campaignId };
  if (statusFilter) {
    whereCondition.applicationStatus = statusFilter;
  }

  const applicants = await CampaignApplication.findAll({
    where: whereCondition,
    attributes: [
      "id",
      "applicationStatus",
      "pitch",
      "createdAt",
    ],
    include: [
      {
        model: CreatorProfile,
        as: "creator",
        where: {
          status: "approved",
          isDeleted: false,
        },
        required: true,
        attributes: ["id", "firstName", "lastName", "bio", "city", "primaryNiches", "secondaryNiches"],
        include: [
          {
            model: CreatorMedia,
            as: "mediaLinks",
            attributes: ["usageType"],
            include: [{ model: Media, as: "mediaDetails" }],
          },
        ],
      },
      {
        model: CampaignApplicationMedia,
        as: "applicationMedia",
        include: [{ model: Media, as: "mediaDetails" }],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return applicants.map((app) => {
    const json = app.toJSON();

    const applicationMediaCleaned = json.applicationMedia.map((m) => ({
      ...enrichMediaRecord(m.mediaDetails),
      usageType: m.usageType,
    }));

    const creatorMediaRaw = (json.creator.mediaLinks || []).map(enrichLinkRecord);

    const { mediaLinks: creatorMediaLinksCleaned, ...creatorRest } =
      json.creator;
    const { applicationMedia, creator, ...applicationRest } = json;

    return {
      ...applicationRest,
      applicationMedia: applicationMediaCleaned,
      creator: {
        ...creatorRest,
        mediaLinks: creatorMediaRaw,
      },
    };
  });
};

const updateApplicationStatus = async (applicationId, brandId, newStatus) => {
  const transaction = await sequelize.transaction();

  try {
    const application = await CampaignApplication.findByPk(applicationId, {
      include: [
        {
          model: Campaign,
          as: "campaign",
          attributes: ["id", "brandId", "campaignTitle", "compensationType"],
        },
      ],
      transaction,
    });

    if (!application) {
      throw new AppError("Application not found.", 400);
    }

    if (application.campaign.brandId !== brandId) {
      throw new AppError(
        "Permission denied: Brand does not own the campaign associated with this application.",
        403
      );
    }

    const previousStatus = application.applicationStatus;

    if (previousStatus === newStatus) {
      await transaction.commit();
      return { application, chatRoom: null, job: null };
    }

    await application.update(
      { applicationStatus: newStatus },
      { transaction }
    );

    let chatRoom = null;
    let job = null;

    if (newStatus === "accepted" && previousStatus !== "accepted") {
      chatRoom = await findOrCreateCampaignChatRoom(
        brandId,
        application.creatorId,
        application.campaignId,
        { transaction }
      );

      const result = await createJobFromApplication(application, {
        transaction,
      });
      job = result.job;
    }

    await transaction.commit();

    if (newStatus === "accepted" && previousStatus !== "accepted") {
      logCampaignActivity({
        campaignId: application.campaignId,
        actorType: "brand",
        actorId: brandId,
        eventType: ACTIVITY_EVENT_TYPES.APPLICATION_APPROVED,
        metadata: {
          applicationId: application.id,
          creatorId: application.creatorId,
          jobPublicId: job?.publicId || null,
        },
      });
    }

    return { application, chatRoom, job };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

module.exports = {
  applyToCampaign,
  getCreatorApplications,
  viewApplicants,
  updateApplicationStatus,
  withdrawApplication,
};
