const Asset = require("../models/asset.model");
const cloudinary = require("../config/cloudinary.config");
const { uploadToCloudinary } = require("../utils/cloudinaryUtil");
const AppError = require("../utils/appError");

const uploadAsset = async (file, country, category) => {
  if (!file || !file.buffer) {
    throw new AppError("File upload failed", 400);
  }

  const type = file.mimetype.startsWith("image")
    ? "image"
    : file.mimetype.startsWith("video")
    ? "video"
    : "other";

  if (process.env.STORAGE_PROVIDER === "cloudinary") {
    const result = await uploadToCloudinary(file, country, category, type);

    const asset = Asset.create({
      name: file.originalname,
      type,
      country,
      category,
      url: result.url,
      provider: "cloudinary",
      public_id: result.id,
    });

    return asset;
  } else {
    throw new AppError("No valid storage provider configured", 500);
  }
};

const listAssets = async (country, category,type) => {
  const whereClause = {};
  if (country) whereClause.country = country;
  if (category) whereClause.category = category;

  return await Asset.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
  });
};

const listCloudinaryAssets = async () => {
  const resourceTypes = ["image", "video", "raw"];
  const results = {};

  for (const type of resourceTypes) {
    try {
      const res = await cloudinary.api.resources({
        resource_type: type,
        max_results: 500,
      });
      results[type] = res.resources.map((r) => ({
        public_id: r.public_id,
        url: r.secure_url,
        folder: r.folder,
      }));
    } catch (err) {
      console.error(`[Cloudinary] Error fetching ${type}:`, err.message);
    }
  }

  console.log("[Cloudinary] Discovered assets:", results);
  return results;
};

module.exports = { uploadAsset, listAssets, listCloudinaryAssets };
