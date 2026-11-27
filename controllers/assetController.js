const {
  uploadAsset,
  listAssets,
  listCloudinaryAssets,
} = require("../services/assetService");
const AppError = require("../utils/appError");

const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const { country, category } = req.params;
    if (!file) throw new AppError("No file uploaded", 400);
    if (!country || !category)
      throw new AppError("Country and category are required", 400);

    console.log(
      `File received: ${file.originalname}, Country: ${country}, Category: ${category}`
    );

    const uploaded = await uploadAsset(file, country, category);

    res.status(201).json({
      message: "File uploaded successfully",
      asset: uploaded,
    });
  } catch (err) {
    console.error("Upload error : ", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const getAssets = async (req, res) => {
  const { country, category } = req.params;
  const assets = await listAssets(country, category);
  res.status(200).json({ assets });
};

const getCloudinaryAssets = async (req, res) => {
  try {
    const assets = await listCloudinaryAssets();
    res.status(200).json({ assets });
  } catch (err) {
    console.error("Get Cloudinary Assets : ", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

module.exports = { uploadFile, getAssets, getCloudinaryAssets };
