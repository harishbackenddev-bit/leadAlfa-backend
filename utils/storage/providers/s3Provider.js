"use strict";

const {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require("fs");
const mime = require("mime-types");
const { v4: uuidv4 } = require("uuid");
const AppError = require("../../appError");


let _s3Client = null;

function getS3Client() {
  if (!_s3Client) {
    if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new AppError("S3 provider is not configured.", 500);
    }
    _s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

function resolveEffectiveMime(file) {
  if (!file) return "application/octet-stream";
  const rawMime = file.mimetype;
  if (!rawMime || rawMime === "application/octet-stream" || rawMime === "binary/octet-stream") {
    const lookedUp = mime.lookup(file.originalname || "");
    if (lookedUp) return lookedUp;
  }
  return rawMime || "application/octet-stream";
}

/**
 * Generates a secure, deterministic S3 object key.
 *
 * Format: media/{subFolder}/{uuid}.{ext}
 * - subFolder mirrors existing mediaService folder paths (e.g. "creators/42/profile_photo")
 * - UUID (v4) used as filename — user-supplied filenames NEVER appear in the key
 * - Extension derived from server-validated MIME type
 *
 * @param {import("express").Request["file"]} file 
 * @param {string} subFolder                       
 * @returns {string}
 */
function generateObjectKey(file, subFolder) {
  const effectiveMime = resolveEffectiveMime(file);
  const ext = mime.extension(effectiveMime) || "bin";
  const uuid = uuidv4();
  return `media/${subFolder}/${uuid}.${ext}`;
}

// ---------------------------------------------------------------------------
// upload()
// ---------------------------------------------------------------------------

/**
 * Upload a file (buffer or disk) to S3.
 *
 * Returns the same logical interface expected by mediaService.uploadMediaData():
 *   { storageKey, s3Bucket, mimeType, fileSize, provider: "s3" }
 *
 * For large files (videos on disk), uses @aws-sdk/lib-storage Upload which
 * automatically performs multipart upload above the 5MB threshold.
 *
 * @param {import("express").Request["file"]} file
 * @param {string} subFolder
 * @returns {Promise<{ storageKey: string, s3Bucket: string, mimeType: string, fileSize: number, provider: "s3" }>}
 */
const upload = async (file, subFolder = "general") => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new AppError("AWS_S3_BUCKET is not configured.", 500);

  const effectiveMime = resolveEffectiveMime(file);
  file.mimetype = effectiveMime;

  const key = generateObjectKey(file, subFolder);
  const s3 = getS3Client();

  try {
    if (file.path) {
      const fileStream = fs.createReadStream(file.path);
      const uploader = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: fileStream,
          ContentType: effectiveMime,
        },
        queueSize: 4,   
        partSize: 1024 * 1024 * 10, 
        leavePartsOnError: false,
      });

      await uploader.done();

      const fileSize = file.size || 0;

      return {
        storageKey: key,
        s3Bucket: bucket,
        mimeType: file.mimetype,
        fileSize,
        provider: "s3",
      };
    } else if (file.buffer) {
  
      const uploader = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        },
      });

      await uploader.done();

      return {
        storageKey: key,
        s3Bucket: bucket,
        mimeType: file.mimetype,
        fileSize: file.buffer.length,
        provider: "s3",
      };
    } else {
      throw new AppError("File has neither path nor buffer — cannot upload to S3.", 500);
    }
  } finally {
    if (file.path) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error(`[S3Provider] Failed to delete temp file ${file.path}:`, err.message);
        }
      });
    }
  }
};

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

/**
 * Delete a single S3 object by key.
 * Called by deleteMediaData() after DB record is destroyed.
 *
 * @param {string} storageKey - S3 object key
 */
const remove = async (storageKey) => {
  if (!storageKey) throw new AppError("storageKey is required for S3 deletion.", 400);

  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new AppError("AWS_S3_BUCKET is not configured.", 500);

  const s3 = getS3Client();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );
};

// ---------------------------------------------------------------------------
// headObject()
// ---------------------------------------------------------------------------

/**
 * Retrieve metadata for an S3 object without downloading the body.
 *
 * Note on IAM: HeadObject requires s3:GetObject permission (not a separate
 * s3:HeadObject action). The backend IAM policy must include s3:GetObject.
 *
 * Used by registerUploadedMedia() (Phase 2) to verify file existence and
 * get server-authoritative MIME type + size after a direct presigned PUT.
 *
 * @param {string} storageKey
 * @returns {Promise<{ contentType: string, contentLength: number }>}
 */
const headObject = async (storageKey) => {
  if (!storageKey) throw new AppError("storageKey is required for HeadObject.", 400);

  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new AppError("AWS_S3_BUCKET is not configured.", 500);

  const s3 = getS3Client();

  const result = await s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );

  return {
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength || 0,
  };
};

// ---------------------------------------------------------------------------
// generatePresignedGetUrl() — for secure document access (Phase 1 secure-url endpoint)
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived S3 presigned GET URL for private document access.
 *
 * Used for sensitive documents (residence permits, operating attachments)
 * where we want explicit, time-limited access rather than relying on the
 * ImageKit URL being obscure.
 *
 * @param {string} storageKey
 * @param {number} [expiresInSeconds=900] - Default 15 minutes
 * @returns {Promise<string>} - Presigned GET URL
 */
const generatePresignedGetUrl = async (storageKey, expiresInSeconds = 900) => {
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const { GetObjectCommand } = require("@aws-sdk/client-s3");

  if (!storageKey) throw new AppError("storageKey is required.", 400);

  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new AppError("AWS_S3_BUCKET is not configured.", 500);

  const s3 = getS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

module.exports = {
  upload,
  remove,
  headObject,
  generatePresignedGetUrl,
  generateObjectKey,
};
