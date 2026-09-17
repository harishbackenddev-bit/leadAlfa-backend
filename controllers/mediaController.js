const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const { registerUploadedMedia } = require("../services/mediaService");
const { buildUrl, enrichMediaRecord } = require("../utils/mediaDelivery");
const s3Provider = require("../utils/storage/providers/s3Provider");
const Media = require("../models/media/media.model");

const registerMediaController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      s3Key,
      mimeType,
      originalName,
      original_name,
      public_id,
      secure_url,
      resource_type,
      bytes,
    } = req.body;

    const media = await registerUploadedMedia({
      s3Key,
      mimeType,
      originalName: originalName || original_name,
      publicId: public_id,
      secureUrl: secure_url,
      resourceType: resource_type,
      bytes,
      userId: req.user.id,
    });

    const enriched = enrichMediaRecord(media);

    return res.status(201).json({
      mediaId: media.id,
      media: enriched,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Error registering media:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const getSecureMediaUrl = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const media = await Media.findByPk(mediaId);

    if (!media) {
      return res.status(404).json({ error: "Media not found." });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = media.uploadedBy && media.uploadedBy === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Access denied to this media resource." });
    }

    if (media.provider === "s3" && media.storageKey) {
      const presignedUrl = await s3Provider.generatePresignedGetUrl(media.storageKey, 900);
      return res.status(200).json({
        url: presignedUrl,
        expiresInSeconds: 900,
        provider: "s3",
      });
    }

    return res.status(200).json({
      url: buildUrl(media),
      provider: media.provider,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error generating secure media URL:", err.message);
    return res.status(500).json({ error: "Failed to generate secure URL." });
  }
};

const downloadMediaController = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const media = await Media.findByPk(mediaId);

    if (!media) {
      return res.status(404).json({ error: "Media not found." });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = media.uploadedBy && media.uploadedBy === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Access denied to this media resource." });
    }

    if (media.provider === "s3" && media.storageKey) {
      if (media.type === "document" || media.mimeType?.includes("zip") || media.mimeType?.includes("pdf")) {
        const presignedUrl = await s3Provider.generatePresignedGetUrl(media.storageKey, 900);
        return res.status(200).json({
          downloadUrl: presignedUrl,
          expiresInSeconds: 900,
          provider: "s3",
        });
      }
    }

    return res.status(200).json({
      downloadUrl: buildUrl(media),
      provider: media.provider,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error generating media download URL:", err.message);
    return res.status(500).json({ error: "Failed to generate download URL." });
  }
};

module.exports = {
  registerMediaController,
  getSecureMediaUrl,
  downloadMediaController,
};
