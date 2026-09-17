const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("../config/cloudinary.config");
const { setUploadSession } = require("../utils/redisUtil");
const AppError = require("../utils/appError");

const ALLOWED_RESOURCE_TYPES = ["video", "image", "raw"];
const ALLOWED_UPLOAD_TYPES = ["campaign_application", "work_submission", "chat_media", "portfolio_video", "creator_intro_video"];

const S3_PREFIX_MAP = {
  campaign_application: "campaign_applications",
  work_submission: "work_submissions",
  chat_media: "chat_messages",
  portfolio_video: "creator_portfolio",
  creator_intro_video: "creator_intro_videos",
};

const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER_PREFIX || "creatrend";

const CAMPAIGN_APPLICATION_FOLDER = `${FOLDER_PREFIX}/media_assets/campaign_applications`;
const WORK_SUBMISSION_FOLDER = `${FOLDER_PREFIX}/media_assets/work_submissions`;
const CHAT_MEDIA_FOLDER = `${FOLDER_PREFIX}/media_assets/chat_messages`;
const CREATOR_PORTFOLIO_FOLDER = `${FOLDER_PREFIX}/media_assets/creator_portfolio`;
const CREATOR_INTRO_VIDEO_FOLDER = `${FOLDER_PREFIX}/media_assets/creator_intro_videos`;

const FOLDER_MAP = {
  campaign_application: CAMPAIGN_APPLICATION_FOLDER,
  work_submission: WORK_SUBMISSION_FOLDER,
  chat_media: CHAT_MEDIA_FOLDER,
  portfolio_video: CREATOR_PORTFOLIO_FOLDER,
  creator_intro_video: CREATOR_INTRO_VIDEO_FOLDER,
};

const generateUploadSignature = async ({ resourceType, uploadType = "campaign_application", userId }) => {
  if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
    throw new AppError(`Invalid resourceType. Must be one of: ${ALLOWED_RESOURCE_TYPES.join(", ")}`, 400);
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(uploadType)) {
    throw new AppError(`Invalid uploadType. Must be one of: ${ALLOWED_UPLOAD_TYPES.join(", ")}`, 400);
  }

  const activeProvider = process.env.STORAGE_PROVIDER || "cloudinary";

  if (activeProvider === "s3") {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new AppError("AWS_S3_BUCKET is not configured.", 500);

    const s3SubFolder = S3_PREFIX_MAP[uploadType];
    const uuid = uuidv4();

    const extMap = { video: "mp4", image: "jpg", raw: "zip" };
    const ext = extMap[resourceType] || "bin";

    const userScopedTypes = ["portfolio_video", "creator_intro_video"];
    const s3Key =
      userScopedTypes.includes(uploadType) && userId
        ? `media/${s3SubFolder}/${userId}/${uuid}.${ext}`
        : `media/${s3SubFolder}/${uuid}.${ext}`;

    const ttlSeconds = uploadType === "creator_intro_video" ? 900 : 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: ttlSeconds });

    try {
      await setUploadSession(userId, s3Key, {
        userId,
        uploadType,
        resourceType,
        s3Key,
        issuedAt: new Date().toISOString(),
      }, ttlSeconds);
    } catch (redisErr) {
      console.error("[UploadService] Failed to set Redis upload session:", redisErr.message);
    }

    return {
      presignedUrl,
      s3Key,
      s3Bucket: bucket,
      expiresAt,
      resourceType,
      uploadType,
      provider: "s3",
    };
  }

  const baseFolder = FOLDER_MAP[uploadType];
  if (!baseFolder) {
    throw new AppError("Invalid uploadType context.", 400);
  }

  const userScopedTypes = ["portfolio_video", "creator_intro_video"];
  const folder =
    userScopedTypes.includes(uploadType) && userId
      ? `${baseFolder}/${userId}`
      : baseFolder;

  const timestamp = Math.round(Date.now() / 1000) + 3600;

  const paramsToSign = {
    folder,
    timestamp,
    use_filename: true,
    unique_filename: true,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    resourceType,
    use_filename: true,
    unique_filename: true,
    provider: "cloudinary",
  };
};

module.exports = {
  generateUploadSignature,
  CAMPAIGN_APPLICATION_FOLDER,
  WORK_SUBMISSION_FOLDER,
  CHAT_MEDIA_FOLDER,
  CREATOR_PORTFOLIO_FOLDER,
  CREATOR_INTRO_VIDEO_FOLDER,
};
