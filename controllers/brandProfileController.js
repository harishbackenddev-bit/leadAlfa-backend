const {
  createOrUpdateBrandProfile,
  getBrandProfile,
} = require("../services/brandProfileService");
const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

const createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const { brandPrimaryIndustry, ...restBody } = req.body;
    
    let parsedIndustry = [];
    if (brandPrimaryIndustry) {
      try {
        parsedIndustry = JSON.parse(brandPrimaryIndustry);
      } catch (e) {
        parsedIndustry = Array.isArray(brandPrimaryIndustry) ? brandPrimaryIndustry : [brandPrimaryIndustry];
      }
    }

    const profileData = {
      ...restBody,
      brandPrimaryIndustry: parsedIndustry.length > 0 ? parsedIndustry : null
    };

    const files = req.files || {};

    const result = await createOrUpdateBrandProfile(userId, profileData, files);

    return res.status(200).json({
      message: "Brand profile saved successfully",
      profile: result.profile,
      media: result.media,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error saving brand profile:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getBrandProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Brand profile not found." });
    }
    return res.status(200).json({ profile });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching brand profile:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getProfile,
};
