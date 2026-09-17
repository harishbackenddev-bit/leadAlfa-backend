const { sequelize } = require("../config/database");
const BrandProfile = require("../models/brandProfile/brandProfile.model");
const Media = require("../models/media/media.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const { uploadBrandMedia, deleteMediaData } = require("./mediaService");
const { BRAND_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { maskBrandProfile } = require("../utils/dataMasker");

const handleBrandMediaUploads = async (
  userId,
  brandProfileId,
  files,
  transaction
) => {
  const uploadedMedia = {};
  const mediaMapping = [
    { field: "logo", type: BRAND_MEDIA_TYPES.LOGO, mediaKey: "logo" },
    {
      field: "operatingAttachment",
      type: BRAND_MEDIA_TYPES.OPERATING_ATTACHMENT,
      mediaKey: "operatingAttachment",
    },
  ];

  for (const { field, type, mediaKey } of mediaMapping) {
    if (files[field]?.[0]) {

      // Remove existing media of the same type
      const existingLinks = await BrandMedia.findAll({
        where: {brandId: brandProfileId, usageType: type },
        attributes: ["mediaId"],
        transaction,
      });

      if(existingLinks && existingLinks.length > 0)
      {
        const existingMediaIds = existingLinks.map((link) => link.mediaId);
        await deleteMediaData(existingMediaIds, transaction);
      }

      const rawMedia = await uploadBrandMedia(
        userId,
        brandProfileId,
        files[field][0],
        type,
        transaction
      );
      uploadedMedia[mediaKey] = enrichMediaRecord(rawMedia);
    }
  }

  return uploadedMedia;
};

const createOrUpdateBrandProfile = async (userId, profileData, files) => {
  const transaction = await sequelize.transaction();
  try {
    let profile = await BrandProfile.findOne({ where: { userId } });

    console.log("Profile Data:", profileData);

    if (profile) {
      if (typeof profileData.companyRegistrationNumber === "string" && profileData.companyRegistrationNumber.includes("*")) {
        delete profileData.companyRegistrationNumber;
      }
      if (typeof profileData.phoneNumber === "string" && profileData.phoneNumber.includes("*")) {
        delete profileData.phoneNumber;
      }
      await profile.update(profileData, { transaction });
    } else {
      profile = await BrandProfile.create(
        {
          ...profileData,
          userId,
        },
        { transaction }
      );
    }

    const uploadedMedia = await handleBrandMediaUploads(
      userId,
      profile.id,
      files,
      transaction
    );

    await transaction.commit();

    return { profile: maskBrandProfile(profile), media: uploadedMedia };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const { enrichLinkRecord, enrichMediaRecord } = require("../utils/mediaDelivery");

const getBrandProfile = async (userId, options = {}) => {
  const maskSensitiveData = options.maskSensitiveData !== false;

  const profile = await BrandProfile.findOne({
    where: { userId },
    include: [
      {
        model: BrandMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
        order: [["createdAt", "DESC"]],
      },
    ],
  });

  if (!profile) return null;

  const json = profile.toJSON();
  const enrichedMediaLinks = json.mediaLinks?.map(enrichLinkRecord) || [];

  const logo = enrichedMediaLinks.find(
    (m) => m.usageType === BRAND_MEDIA_TYPES.LOGO
  );

  const operatingAttachment = enrichedMediaLinks.find(
    (m) => m.usageType === BRAND_MEDIA_TYPES.OPERATING_ATTACHMENT
  );

  const { mediaLinks, ...rest } = json;

  const profileData = {
    ...rest,
    media: {
      logo: logo || null,
      operatingAttachment: operatingAttachment || null,
    },
  };

  return maskSensitiveData ? maskBrandProfile(profileData) : profileData;
};

const getBrandIdByUser = async (userId) => {
  const brand = await BrandProfile.findOne({
    where: { userId },
    attributes: ["id"],
  });

  return brand?.id || null;
};

const getBrandUserId = async (brandId) => {
  const brand = await BrandProfile.findByPk(brandId, {
    attributes: ["userId"],
  });

  return brand?.userId || null;
};

module.exports = {
  createOrUpdateBrandProfile,
  getBrandProfile,
  getBrandIdByUser,
  getBrandUserId,
};
