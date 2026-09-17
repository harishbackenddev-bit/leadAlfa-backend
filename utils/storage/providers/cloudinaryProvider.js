const cloudinary = require("../../../config/cloudinary.config");
const slugify = require("slugify");
const streamifier = require("streamifier");
const fs = require("fs").promises;

const upload = async (file, subFolder = "general") => {
  const originalName = file.originalname || "";
  const lastDotIndex = originalName.lastIndexOf(".");
  const hasExtension = lastDotIndex !== -1;
  const baseName = hasExtension ? originalName.substring(0, lastDotIndex) : originalName;
  const extension = hasExtension ? originalName.substring(lastDotIndex) : "";

  const safeBaseName = slugify(baseName, {
    lower: true,
    strict: true,
  });

  const folderPrefix = process.env.CLOUDINARY_FOLDER_PREFIX || "creatrend";
  const folderPath = `${folderPrefix}/media_assets/${subFolder}`;

  const isDocument = file.mimetype && (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/"));
  const resourceType = isDocument ? "raw" : "auto";

  const public_id = resourceType === "raw" && extension
    ? `${safeBaseName}_${Date.now()}${extension}`
    : `${safeBaseName}_${Date.now()}`;

  try {
    if (file.path) {
      // Disk Storage handling (optimized for large files/videos)
      const options = {
        folder: folderPath,
        public_id: public_id,
        resource_type: resourceType,
      };

      let result;
      if (file.mimetype && file.mimetype.startsWith("video/")) {
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(file.path, options, (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          });
        });
      } else {
        result = await cloudinary.uploader.upload(file.path, options);
      }

      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        provider: "cloudinary",
      };
    } else if (file.buffer) {
      // Memory Storage handling (stream for small files)
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            public_id: public_id,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) reject(error);
            else
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                provider: "cloudinary",
              });
          }
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    } else {
      throw new Error("Invalid file object provided for upload");
    }
  } finally {
    // Always clean up temp files
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        console.error("Failed to clean up temp file:", file.path, cleanupError);
      }
    }
  }
};

const remove = async (publicId) => {
  if (!publicId) throw new Error("Public ID is required for deletion");
  
  const resourceTypes = ["image", "video", "raw"];
  let lastResult = { result: "not found" };

  for (const type of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: type });
      if (result.result === "ok") {
        return result;
      }
      lastResult = result;
    } catch (err) {
      console.error(`[Cloudinary Remove] Error deleting ${publicId} as ${type}:`, err.message);
      lastResult = { result: "error", error: err.message };
    }
  }

  return lastResult;
};

module.exports = { upload, remove };
