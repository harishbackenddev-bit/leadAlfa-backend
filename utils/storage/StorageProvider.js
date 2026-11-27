const cloudinaryProvider = require("./providers/cloudinaryProvider");
const s3Provider = require("./providers/s3Provider");

const PROVIDERS = {
  cloudinary: cloudinaryProvider,
  s3: s3Provider,
};

const getActiveProvider = () => {
  const providerName = process.env.STORAGE_PROVIDER || "cloudinary";
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unsupported STORAGE_PROVIDER: "${providerName}". Allowed values: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return provider;
};

const uploadMedia = async (file, subFolder = "general") => {
  if (!file) throw new Error("No file provided for upload");
  return getActiveProvider().upload(file, subFolder);
};

const deleteMedia = async (fileId) => {
  return getActiveProvider().remove(fileId);
};

module.exports = {
  uploadMedia,
  deleteMedia,
  getActiveProvider,
};

