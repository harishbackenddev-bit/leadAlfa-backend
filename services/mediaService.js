const {
  uploadMedia,
  deleteMedia,
} = require("../utils/storage/StorageProvider");
const s3Provider = require("../utils/storage/providers/s3Provider");
const {
  CAMPAIGN_APPLICATION_FOLDER,
  WORK_SUBMISSION_FOLDER,
  CREATOR_PORTFOLIO_FOLDER,
  CREATOR_INTRO_VIDEO_FOLDER,
} = require("./uploadService");
const Media = require("../models/media/media.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const BrandMedia = require("../models/brandProfile/brandMedia.model");
const CampaignMedia = require("../models/campaigns/campaignMedia.model");
const CampaignApplicationMedia = require("../models/campaigns/campaignApplicationMedia.model");

const mime = require("mime-types");

function resolveEffectiveMime(file) {
  if (!file) return "application/octet-stream";
  const rawMime = file.mimetype;
  if (!rawMime || rawMime === "application/octet-stream" || rawMime === "binary/octet-stream") {
    const lookedUp = mime.lookup(file.originalname || "");
    if (lookedUp) return lookedUp;
  }
  return rawMime || "application/octet-stream";
}

function getMediaType(mimeType) {
  if (!mimeType) return "other";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  if (mimeType.startsWith("application/") || mimeType.startsWith("text/")) {
    return "document";
  }

  return "other";
}

const uploadMediaData = async (
  userId,
  file,
  folderPath = "general",
  transaction = null
) => {
  const effectiveMime = resolveEffectiveMime(file);
  file.mimetype = effectiveMime;

  const uploadResult = file.uploadResult || (await uploadMedia(file, folderPath));
  const isS3 = uploadResult.provider === "s3";
  const mediaType = getMediaType(effectiveMime);

  const media = await Media.create(
    {
      name: file.originalname,
      url: isS3 ? "" : (uploadResult.secure_url || ""),
      type: mediaType,
      provider: uploadResult.provider || "cloudinary",
      public_id: isS3 ? null : uploadResult.public_id,
      storageKey: isS3 ? uploadResult.storageKey : null,
      s3Bucket: isS3 ? uploadResult.s3Bucket : null,
      mimeType: isS3 ? uploadResult.mimeType : effectiveMime,
      fileSize: isS3 ? uploadResult.fileSize : (file.size || null),
      uploadedBy: userId,
    },
    { transaction }
  );
  return media;
};

const linkMediaToEntity = async (
  entityType,
  entityId,
  mediaId,
  usageType,
  transaction
) => {
  let LinkModel;
  let foreignKey;

  if (entityType === "brand") {
    LinkModel = BrandMedia;
    foreignKey = "brandId";
  } else if (entityType === "creator") {
    LinkModel = CreatorMedia;
    foreignKey = "creatorId";
  } else if (entityType === "campaign") {
    LinkModel = CampaignMedia;
    foreignKey = "campaignId";
  } else if (entityType === "campaignApplication") {
    LinkModel = CampaignApplicationMedia;
    foreignKey = "campaignApplicationId";
  } else {
    throw new Error(`Unsupported entity type for media linking: ${entityType}`);
  }

  return LinkModel.create(
    {
      [foreignKey]: entityId,
      mediaId,
      usageType,
    },
    { transaction }
  );
};

const performStorageDeletion = async (cloudinaryIds, s3Keys) => {
  if (cloudinaryIds.length > 0) {
    await Promise.allSettled(cloudinaryIds.map((id) => deleteMedia(id)));
  }
  if (s3Keys.length > 0) {
    await Promise.allSettled(
      s3Keys.map(async (key) => {
        try {
          await s3Provider.remove(key);
        } catch (err) {
          console.error(`[Delete] S3 cleanup failed for key ${key}:`, err.message);
        }
      })
    );
  }
};

const deleteMediaData = async (mediaIds, transaction = null, deleteStorage = true) => {
  if (!mediaIds || mediaIds.length === 0) return [];

  const mediaRecords = await Media.findAll({
    where: { id: mediaIds },
    attributes: ["id", "provider", "public_id", "storageKey"],
    transaction,
  });

  const cloudinaryIds = mediaRecords
    .filter((r) => r.provider === "cloudinary" && r.public_id)
    .map((r) => r.public_id);

  const s3Keys = mediaRecords
    .filter((r) => r.provider === "s3" && r.storageKey)
    .map((r) => r.storageKey);

  await Media.destroy({ where: { id: mediaIds }, transaction });

  if (deleteStorage) {
    if (transaction && typeof transaction.afterCommit === "function") {
      transaction.afterCommit(async () => {
        await performStorageDeletion(cloudinaryIds, s3Keys);
      });
    } else {
      await performStorageDeletion(cloudinaryIds, s3Keys);
    }
  }

  return [...cloudinaryIds, ...s3Keys];
};

const uploadMediaToCloudinary = async (userId, file, usageType, entity = "creator") => {
  const folderPath = `${entity}s/u_${userId}/${usageType}`;
  return await uploadMedia(file, folderPath);
};

const uploadCreatorMedia = async (
  userId,
  creatorId,
  file,
  usageType,
  transaction = null
) => {
  const folderPath = `creators/${creatorId}/${usageType}`;
  const media = await uploadMediaData(userId, file, folderPath, transaction);

  await linkMediaToEntity(
    "creator",
    creatorId,
    media.id,
    usageType,
    transaction
  );

  return media;
};

const uploadBrandMedia = async (
  userId,
  brandId,
  file,
  usageType,
  transaction = null
) => {
  const folderPath = `brands/${brandId}/${usageType}`;
  const media = await uploadMediaData(userId, file, folderPath, transaction);

  await linkMediaToEntity("brand", brandId, media.id, usageType, transaction);

  return media;
};

const uploadCampaignMedia = async (
  userId,
  campaignId,
  file,
  usageType,
  transaction = null
) => {
  const folderPath = `campaigns/${campaignId}/${usageType}`;
  const media = await uploadMediaData(userId, file, folderPath, transaction);

  await linkMediaToEntity(
    "campaign",
    campaignId,
    media.id,
    usageType,
    transaction
  );

  return media;
};

const uploadChatMessageMedia = async (userId, files, transaction = null) => {
  if (!files || files.length === 0) return [];
  const folderPath = `chatMessages/${userId}`;
  const uploadPromises = files.map((file) =>
    uploadMediaData(userId, file, folderPath, transaction)
  );
  const mediaRecords = await Promise.all(uploadPromises);
  return mediaRecords;
};

const registerUploadedMedia = async ({
  s3Key,
  mimeType: reqMimeType,
  publicId,
  secureUrl,
  resourceType,
  originalName,
  bytes,
  userId,
  transaction = null,
}) => {
  if (s3Key) {
    const { getUploadSession, deleteUploadSession } = require("../utils/redisUtil");
    const session = await getUploadSession(userId, s3Key);

    if (session) {
      if (session.userId !== userId) {
        throw new AppError("Not authorized to register this asset.", 403);
      }
      await deleteUploadSession(userId, s3Key);
    }

    const allowedPrefixes = [
      "media/campaign_applications/",
      "media/work_submissions/",
      "media/chat_messages/",
      "media/creator_portfolio/",
      "media/creator_intro_videos/",
    ];
    const hasValidPrefix = allowedPrefixes.some((prefix) => s3Key.startsWith(prefix));
    if (!hasValidPrefix) {
      throw new AppError(
        `Invalid s3Key prefix: asset must reside in one of: ${allowedPrefixes.join(", ")}`,
        400
      );
    }

    const s3Provider = require("../utils/storage/providers/s3Provider");
    let headResult;
    try {
      headResult = await s3Provider.headObject(s3Key);
    } catch (err) {
      throw new AppError(`Uploaded file not found in storage bucket: ${err.message}`, 404);
    }

    if (!headResult || !headResult.contentLength) {
      throw new AppError("Uploaded file not found or is empty in storage bucket.", 404);
    }

    const verifiedMimeType =
      headResult.contentType && headResult.contentType !== "application/octet-stream"
        ? headResult.contentType
        : mime.lookup(originalName || s3Key) || reqMimeType || "application/octet-stream";

    const mediaType = getMediaType(verifiedMimeType);

    const media = await Media.create(
      {
        name: originalName || s3Key.split("/").pop(),
        url: "",
        type: mediaType,
        provider: "s3",
        public_id: null,
        storageKey: s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET,
        mimeType: verifiedMimeType,
        fileSize: headResult.contentLength,
        uploadedBy: userId,
      },
      { transaction }
    );

    return media;
  }

  if (!publicId) {
    throw new AppError("Either s3Key or public_id is required to register media.", 400);
  }

  const allowedFolders = [CAMPAIGN_APPLICATION_FOLDER, WORK_SUBMISSION_FOLDER, CREATOR_PORTFOLIO_FOLDER, CREATOR_INTRO_VIDEO_FOLDER];
  const isValidFolder = allowedFolders.some((folder) => publicId.startsWith(folder));

  if (!isValidFolder) {
    const error = new Error(
      `Invalid public_id: asset must reside in one of the allowed folders: ${allowedFolders.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (resourceType === "raw") {
    if (bytes && bytes > 200 * 1024 * 1024) {
      const error = new Error("File size exceeds the maximum limit of 200MB.");
      error.statusCode = 400;
      throw error;
    }
    const hasZipExtension = 
      (originalName && originalName.toLowerCase().endsWith(".zip")) ||
      (publicId && publicId.toLowerCase().endsWith(".zip"));
    if (!hasZipExtension) {
      const error = new Error("Invalid file extension: Only ZIP archives are allowed for raw uploads.");
      error.statusCode = 400;
      throw error;
    }
  }

  const mediaTypeMap = {
    video: "video",
    image: "image",
    raw: "document",
  };

  const mediaType = mediaTypeMap[resourceType] || "other";

  const media = await Media.create(
    {
      name: originalName || publicId.split("/").pop(),
      url: secureUrl,
      type: mediaType,
      provider: "cloudinary",
      public_id: publicId,
      uploadedBy: userId,
    },
    { transaction }
  );

  return media;
};

module.exports = {
  uploadCreatorMedia,
  uploadBrandMedia,
  uploadCampaignMedia,
  deleteMediaData,
  linkMediaToEntity,
  uploadChatMessageMedia,
  uploadMediaToCloudinary,
  registerUploadedMedia,
};
