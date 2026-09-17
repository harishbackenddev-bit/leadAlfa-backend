
const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const Media = require("../models/media/media.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const Category = require("../models/creatorProfile/category.model");
const Skill = require("../models/creatorProfile/skill.model");
const { CREATOR_MEDIA_TYPES } = require("../config/mediaUsageTypes");
const { uploadCreatorMedia, deleteMediaData, uploadMediaToCloudinary } = require("./mediaService");
const { enrichLinkRecord, enrichMediaRecord } = require("../utils/mediaDelivery");
const { maskCreatorProfile } = require("../utils/dataMasker");
const AppError = require("../utils/appError");

const checkPublicNameAvailability = async (userId, name) => {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("Name parameter is required.", 400);
  }

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    throw new AppError("Public name must be between 2 and 50 characters.", 400);
  }

  const normalized = trimmed.toLowerCase();

  const existingProfile = await CreatorProfile.findOne({
    where: {
      isDeleted: false,
      [Op.and]: [
        sequelize.where(
          sequelize.fn("lower", sequelize.fn("trim", sequelize.col("publicName"))),
          normalized
        ),
      ],
    },
    attributes: ["id", "userId", "publicName"],
  });

  if (existingProfile) {
    if (existingProfile.userId === userId) {
      return { available: true };
    }
    return {
      available: false,
      message: "This creator name is already taken.",
    };
  }

  return { available: true };
};

const normalizeUrl = (url) => {
  if (!url || url.trim() === "") return null;

  let normalized = url.trim();

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  return normalized;
};

const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const cleanupStorageAssets = async (assetsOrIds) => {
  if (!assetsOrIds || assetsOrIds.length === 0) return;
  const { deleteMedia } = require("../utils/storage/StorageProvider");
  const s3Provider = require("../utils/storage/providers/s3Provider");

  for (const item of assetsOrIds) {
    try {
      if (typeof item === "string") {
        await deleteMedia(item);
      } else if (item && typeof item === "object") {
        const res = item.uploadResult || item;
        if (res.provider === "s3" && res.storageKey) {
          await s3Provider.remove(res.storageKey);
        } else if (res.public_id) {
          await deleteMedia(res.public_id);
        }
      }
    } catch (err) {
      console.error("[cleanupStorageAssets] Rollback failed:", err.message);
    }
  }
};

const cleanupCloudinary = cleanupStorageAssets;

const preUploadCreatorMedia = async (userId, files) => {
  const uploadedAssets = [];

  const mediaMapping = [
    { field: "profilePhoto", type: CREATOR_MEDIA_TYPES.PROFILE_PHOTO, mediaKey: "profilePhoto", multiple: false },
    { field: "residencePermit", type: CREATOR_MEDIA_TYPES.RESIDENCE_PERMIT, mediaKey: "residencePermit", multiple: false },
    { field: "portfolio", type: CREATOR_MEDIA_TYPES.PORTFOLIO, mediaKey: "portfolio", multiple: true },
  ];

  try {
    const uploadTasks = [];

    for (const { field, type, mediaKey, multiple } of mediaMapping) {
      const fileArray = files?.[field];
      if (fileArray && fileArray.length > 0) {
        const filesToProcess = multiple ? fileArray : [fileArray[0]];

        for (const file of filesToProcess) {
          uploadTasks.push(
            (async () => {
              const uploadResult = await uploadMediaToCloudinary(userId, file, type);
              uploadedAssets.push({ field, type, mediaKey, multiple, file, uploadResult });
            })()
          );
        }
      }
    }

    await Promise.all(uploadTasks);
    return uploadedAssets;
  } catch (err) {
    await cleanupStorageAssets(uploadedAssets);
    throw err;
  }
};

const savePreUploadedMedia = async (userId, creatorId, uploadedAssets, transaction, oldPublicIds) => {
  const uploadedMediaMap = {};
  const usageTypesToClean = [...new Set(uploadedAssets.map((a) => a.type))];

  for (const type of usageTypesToClean) {
    const existingLinks = await CreatorMedia.findAll({
      where: { creatorId, usageType: type },
      attributes: ["mediaId"],
      transaction,
    });
    if (existingLinks && existingLinks.length > 0) {
      const existingMediaIds = existingLinks.map((link) => link.mediaId);
      const deletedIds = await deleteMediaData(existingMediaIds, transaction, false);
      if (deletedIds && deletedIds.length > 0) {
        oldPublicIds.push(...deletedIds);
      }
    }
  }

  for (const asset of uploadedAssets) {
    if (asset.file && asset.uploadResult) {
      asset.file.uploadResult = asset.uploadResult;
    }
    const media = await uploadCreatorMedia(
      userId,
      creatorId,
      asset.file,
      asset.type,
      transaction
    );
    const enrichedMedia = enrichMediaRecord(media);

    if (asset.multiple) {
      if (!uploadedMediaMap[asset.mediaKey]) {
        uploadedMediaMap[asset.mediaKey] = [];
      }
      uploadedMediaMap[asset.mediaKey].push(enrichedMedia);
    } else {
      uploadedMediaMap[asset.mediaKey] = enrichedMedia;
    }
  }

  return uploadedMediaMap;
};

const linkIntroVideoMediaId = async (
  userId,
  creatorId,
  introVideoMediaId,
  transaction,
  oldPublicIdsToDelete
) => {
  const parsedMediaId = parseInt(introVideoMediaId, 10);
  if (!parsedMediaId || isNaN(parsedMediaId) || parsedMediaId <= 0) {
    throw new AppError("Invalid or missing introVideoMediaId.", 400);
  }

  const media = await Media.findByPk(parsedMediaId, { transaction });
  if (!media) {
    throw new AppError("Intro video media not found.", 404);
  }

  if (media.uploadedBy !== userId) {
    throw new AppError("You do not have permission to use this media.", 403);
  }

  if (media.type !== "video") {
    throw new AppError("Intro video must be a video file.", 400);
  }

  const alreadyLinkedAsIntro = await CreatorMedia.findOne({
    where: { creatorId, mediaId: parsedMediaId, usageType: CREATOR_MEDIA_TYPES.INTRO_VIDEO },
    transaction,
  });
  if (alreadyLinkedAsIntro) {
    return; 
  }

  const linkedElsewhere = await CreatorMedia.findOne({
    where: { mediaId: parsedMediaId },
    transaction,
  });
  if (linkedElsewhere) {
    throw new AppError("This media is already associated with a profile.", 409);
  }

  const existingLinks = await CreatorMedia.findAll({
    where: { creatorId, usageType: CREATOR_MEDIA_TYPES.INTRO_VIDEO },
    attributes: ["mediaId"],
    transaction,
  });
  if (existingLinks.length > 0) {
    const existingMediaIds = existingLinks.map((l) => l.mediaId);
    const deletedIds = await deleteMediaData(existingMediaIds, transaction, false);
    if (deletedIds && deletedIds.length > 0) {
      oldPublicIdsToDelete.push(...deletedIds);
    }
  }

  await CreatorMedia.create(
    { creatorId, mediaId: parsedMediaId, usageType: CREATOR_MEDIA_TYPES.INTRO_VIDEO },
    { transaction }
  );
};

const syncCreatorRelationships = async (profile, categoryIds, skillIds, transaction) => {
  if (categoryIds !== undefined) {
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      const validCategories = await Category.findAll({
        where: { id: categoryIds },
        attributes: ["id"],
        transaction,
      });

      if (validCategories.length !== categoryIds.length) {
        const error = new Error("One or more category IDs are invalid.");
        error.statusCode = 400;
        throw error;
      }

      await profile.setCategories(categoryIds, { transaction });
    } else {
      await profile.setCategories([], { transaction });
    }
  }

  if (skillIds !== undefined) {
    if (Array.isArray(skillIds) && skillIds.length > 0) {
      const validSkills = await Skill.findAll({
        where: { id: skillIds },
        attributes: ["id"],
        transaction,
      });

      if (validSkills.length !== skillIds.length) {
        const error = new Error("One or more skill IDs are invalid.");
        error.statusCode = 400;
        throw error;
      }

      await profile.setSkills(skillIds, { transaction });
    } else {
      await profile.setSkills([], { transaction });
    }
  }
};

const createOrUpdateCreatorProfile = async (
  userId,
  profileData,
  files,
  categoryIds,
  skillIds,
  introVideoMediaId = null
) => {
  const uploadedAssets = await preUploadCreatorMedia(userId, files);

  const transaction = await sequelize.transaction();
  const oldPublicIdsToDelete = [];

  try {
    let profile = await CreatorProfile.findOne({
      where: { userId },
      transaction,
    });

    const isUpdate = !!profile;

    if (!isUpdate) {
      if (
        profileData.publicName === undefined ||
        profileData.publicName === null ||
        typeof profileData.publicName !== "string" ||
        profileData.publicName.trim() === ""
      ) {
        throw new AppError("Public name is required", 400);
      }

      const requiredAddressFields = [
        "addressLine1",
        "suburb",
        "city",
        "province",
        "postalCode",
      ];
      for (const field of requiredAddressFields) {
        const value = profileData[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          throw new AppError(`${field} is required`, 400);
        }
      }
    }

    if (profileData.dateOfBirth) {
      const age = calculateAge(profileData.dateOfBirth);
      if (age === null || isNaN(age)) {
        throw new AppError("Date of birth must be a valid date", 400);
      }
      if (age < 18) {
        throw new AppError("Creator must be at least 18 years old", 400);
      }
    }

    if (profileData.publicName !== undefined && profileData.publicName !== null) {
      if (typeof profileData.publicName === "string") {
        const trimmedName = profileData.publicName.trim();
        if (trimmedName === "") {
          throw new AppError("Public name cannot be empty", 400);
        }
        if (trimmedName.length < 2 || trimmedName.length > 50) {
          throw new AppError("Public name must be between 2 and 50 characters", 400);
        }
        profileData.publicName = trimmedName;

        const normalizedName = trimmedName.toLowerCase();
        const existingWithName = await CreatorProfile.findOne({
          where: {
            isDeleted: false,
            [Op.and]: [
              sequelize.where(
                sequelize.fn("lower", sequelize.fn("trim", sequelize.col("publicName"))),
                normalizedName
              ),
              ...(isUpdate ? [{ id: { [Op.ne]: profile.id } }] : []),
            ],
          },
          attributes: ["id"],
          transaction,
        });

        if (existingWithName) {
          throw new AppError("This creator name is already taken.", 409);
        }
      }
    }

    if (profileData.website) {
      profileData.website = normalizeUrl(profileData.website);
    }
    if (profileData.instagram) {
      profileData.instagram = normalizeUrl(profileData.instagram);
    }
    if (profileData.tiktok) {
      profileData.tiktok = normalizeUrl(profileData.tiktok);
    }
    if (profileData.youtube) {
      profileData.youtube = normalizeUrl(profileData.youtube);
    }

    if (isUpdate) {
      if (typeof profileData.saIdNumber === "string" && profileData.saIdNumber.includes("*")) {
        delete profileData.saIdNumber;
      }
      if (typeof profileData.passportNumber === "string" && profileData.passportNumber.includes("*")) {
        delete profileData.passportNumber;
      }
      if (typeof profileData.phoneNumber === "string" && profileData.phoneNumber.includes("*")) {
        delete profileData.phoneNumber;
      }

      if (profile.status === "rejected") {
        profileData.status = "pending";
        profileData.rejectionReason = null;
      } else if (profile.status === "clarification_requested") {
        profileData.status = "pending";
        profileData.clarificationRequested = false;
      }

      await profile.update(profileData, { transaction });
    } else {
      profileData.userId = userId;
      profileData.status = "pending";
      profile = await CreatorProfile.create(profileData, { transaction });
    }

    let uploadedMedia = {};
    if (uploadedAssets.length > 0) {
      uploadedMedia = await savePreUploadedMedia(
        userId,
        profile.id,
        uploadedAssets,
        transaction,
        oldPublicIdsToDelete
      );
    }

    if (introVideoMediaId) {
      await linkIntroVideoMediaId(
        userId,
        profile.id,
        introVideoMediaId,
        transaction,
        oldPublicIdsToDelete
      );
    }

    await syncCreatorRelationships(profile, categoryIds, skillIds, transaction);

    await transaction.commit();

    if (oldPublicIdsToDelete.length > 0) {
      await cleanupStorageAssets(oldPublicIdsToDelete);
    }

    return { profile: maskCreatorProfile(profile), media: uploadedMedia };
  } catch (err) {
    await transaction.rollback();

    if (uploadedAssets.length > 0) {
      await cleanupStorageAssets(uploadedAssets);
    }

    if (
      err.name === "SequelizeUniqueConstraintError" ||
      (err.parent && (err.parent.code === "23505" || err.parent.constraint === "idx_creator_profile_public_name_unique"))
    ) {
      throw new AppError("This creator name is already taken.", 409);
    }

    throw err;
  }
};

const getCreatorProfile = async (userId, options = {}) => {
  const maskSensitiveData = options.maskSensitiveData !== false;

  const profile = await CreatorProfile.findOne({
    where: { userId },
    include: [
      {
        model: CreatorMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
        order: [["createdAt", "DESC"]],
      },
      { model: Category, as: "categories", through: { attributes: [] } },
      { model: Skill, as: "skills", through: { attributes: [] } },
    ],
  });

  if (!profile) return null;

  const json = profile.toJSON();

  const enrichedMediaLinks = json.mediaLinks?.map(enrichLinkRecord);

  const profilePhoto = enrichedMediaLinks?.find(
    (m) => m.usageType === CREATOR_MEDIA_TYPES.PROFILE_PHOTO
  );

  const residencePermit = enrichedMediaLinks?.find(
    (m) => m.usageType === CREATOR_MEDIA_TYPES.RESIDENCE_PERMIT
  );

  const introVideo = enrichedMediaLinks?.find(
    (m) => m.usageType === CREATOR_MEDIA_TYPES.INTRO_VIDEO
  );

  const portfolio = enrichedMediaLinks?.filter(
    (m) => m.usageType === CREATOR_MEDIA_TYPES.PORTFOLIO
  );

  const { mediaLinks, ...rest } = json;

  const age = calculateAge(json.dateOfBirth);

  const profileData = {
    ...rest,
    age,
    media: {
      profilePhoto: profilePhoto || null,
      residencePermit: residencePermit || null,
      introVideo: introVideo || null,
      portfolio: portfolio && portfolio.length > 0 ? portfolio : [],
    },
  };

  return maskSensitiveData ? maskCreatorProfile(profileData) : profileData;
};

const getCreatorIdByUser = async (userId) => {
  const creator = await CreatorProfile.findOne({
    where: { userId },
    attributes: ["id"],
  });

  return creator?.id || null;
};

const getCreatorUserId = async (creatorId) => {
  const creator = await CreatorProfile.findByPk(creatorId, {
    attributes: ["userId"],
  });

  return creator?.userId || null;
};

const getCreatorContextByUser = async (userId) => {
  const creator = await CreatorProfile.findOne({
    where: { userId },
    attributes: ["id", "status"],
  });

  return creator ? { id: creator.id, status: creator.status } : null;
};

const getApprovedCreatorsList = async (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await CreatorProfile.findAndCountAll({
    where: {
      status: "approved",
      isDeleted: false,
    },
    include: [
      {
        model: CreatorMedia,
        as: "mediaLinks",
        include: [{ model: Media, as: "mediaDetails" }],
      },
      { model: Category, as: "categories", through: { attributes: [] } },
      { model: Skill, as: "skills", through: { attributes: [] } },
    ],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });

  const creators = rows.map((profile) => {
    const json = profile.toJSON();
    const enrichedMediaLinks = json.mediaLinks?.map(enrichLinkRecord);

    const profilePhoto = enrichedMediaLinks?.find(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.PROFILE_PHOTO
    );

    const residencePermit = enrichedMediaLinks?.find(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.RESIDENCE_PERMIT
    );

    const introVideo = enrichedMediaLinks?.find(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.INTRO_VIDEO
    );

    const portfolio = enrichedMediaLinks?.filter(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.PORTFOLIO
    );

    const { mediaLinks, ...rest } = json;

    const age = calculateAge(json.dateOfBirth);

    return maskCreatorProfile({
      ...rest,
      age,
      media: {
        profilePhoto: profilePhoto || null,
        residencePermit: residencePermit || null,
        introVideo: introVideo || null,
        portfolio: portfolio && portfolio.length > 0 ? portfolio : [],
      },
    });
  });

  return {
    creators,
    totalCount: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
  };
};

const reuploadCreatorDocuments = async (userId, files, introVideoMediaId = null) => {
  const hasResidencePermit =
    files && files.residencePermit && files.residencePermit.length > 0;

  if (!hasResidencePermit && !introVideoMediaId) {
    throw new AppError(
      "At least one document (residencePermit file or introVideoMediaId) is required for re-upload.",
      400
    );
  }

  // Only process residence permit as a multipart file; intro video is now direct-upload
  const filteredFiles = {};
  if (hasResidencePermit) {
    filteredFiles.residencePermit = files.residencePermit;
  }

  const uploadedAssets = await preUploadCreatorMedia(userId, filteredFiles);
  const transaction = await sequelize.transaction();
  const oldPublicIdsToDelete = [];

  try {
    const profile = await CreatorProfile.findOne({
      where: { userId },
      transaction,
    });

    if (!profile) {
      throw new AppError("Creator profile not found.", 404);
    }

    if (profile.status === "approved") {
      throw new AppError("Creator profile is already approved.", 400);
    }

    let uploadedMedia = {};
    if (uploadedAssets.length > 0) {
      uploadedMedia = await savePreUploadedMedia(
        userId,
        profile.id,
        uploadedAssets,
        transaction,
        oldPublicIdsToDelete
      );
    }

    if (introVideoMediaId) {
      await linkIntroVideoMediaId(
        userId,
        profile.id,
        introVideoMediaId,
        transaction,
        oldPublicIdsToDelete
      );
    }

    profile.status = "pending";
    profile.clarificationRequested = false;
    profile.rejectionReason = null;
    await profile.save({ transaction });

    await transaction.commit();

    if (oldPublicIdsToDelete.length > 0) {
      await cleanupStorageAssets(oldPublicIdsToDelete);
    }

    const updatedProfile = await getCreatorProfile(userId);

    return {
      profile: updatedProfile,
      media: uploadedMedia,
    };
  } catch (err) {
    await transaction.rollback();

    if (uploadedAssets.length > 0) {
      await cleanupStorageAssets(uploadedAssets);
    }

    throw err;
  }
};

const updateCreatorIntroVideo = async (userId, introVideoMediaId) => {
  const profile = await CreatorProfile.findOne({
    where: { userId },
    attributes: ["id"],
  });

  if (!profile) {
    throw new AppError("Creator profile not found.", 404);
  }

  const transaction = await sequelize.transaction();
  const oldPublicIdsToDelete = [];

  try {
    await linkIntroVideoMediaId(
      userId,
      profile.id,
      introVideoMediaId,
      transaction,
      oldPublicIdsToDelete
    );

    await transaction.commit();

    if (oldPublicIdsToDelete.length > 0) {
      await cleanupStorageAssets(oldPublicIdsToDelete);
    }

    const updatedProfile = await getCreatorProfile(userId);
    return updatedProfile;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

module.exports = {
  createOrUpdateCreatorProfile,
  getCreatorProfile,
  getCreatorIdByUser,
  getCreatorContextByUser,
  getCreatorUserId,
  getApprovedCreatorsList,
  checkPublicNameAvailability,
  reuploadCreatorDocuments,
  updateCreatorIntroVideo,
};
