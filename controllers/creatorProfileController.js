const {
  createOrUpdateCreatorProfile,
  getCreatorProfile,
  getApprovedCreatorsList: getApprovedCreatorsListService,
  checkPublicNameAvailability,
  reuploadCreatorDocuments,
  updateCreatorIntroVideo,
} = require("../services/creatorProfileService");
const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

const createOrUpdateProfile = async (req,res) =>{
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try{
     const userId = req.user.id;
     const {
       categories,
       skills,
       languages,
       primaryNiches,
       secondaryNiches,
       appearance,
       ...profileData
     } = req.body;
     const files = req.files || {};

     const parsedCategories = categories ? JSON.parse(categories) : [];
     const parsedSkills = skills ? JSON.parse(skills) : [];
     const parsedLanguages = languages ? JSON.parse(languages) : [];
     const parsedPrimaryNiches = primaryNiches ? JSON.parse(primaryNiches) : [];
     const parsedSecondaryNiches = secondaryNiches ? JSON.parse(secondaryNiches) : [];
     const parsedAppearance = appearance ? JSON.parse(appearance) : [];

     const introVideoMediaId = profileData.introVideoMediaId
       ? parseInt(profileData.introVideoMediaId, 10)
       : null;
     if (introVideoMediaId) delete profileData.introVideoMediaId;

     const result = await createOrUpdateCreatorProfile(
      userId,
      {
        ...profileData,
        languages: parsedLanguages,
        primaryNiches: parsedPrimaryNiches,
        secondaryNiches: parsedSecondaryNiches,
        appearance: parsedAppearance
      },
      files,
      parsedCategories,
      parsedSkills,
      introVideoMediaId
     );

     return res.status(200).json({
      message: "Creator profile saved successfully",
      profile: result.profile,
      media: result.media,
     });
  }catch(err)
  {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error saving creator profile:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
}

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getCreatorProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Creator profile not found." });
    }
    return res.status(200).json({ profile});
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching creator profile:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const getApprovedCreatorsList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getApprovedCreatorsListService(page, limit);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching creator list:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const checkPublicNameAvailabilityController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.query;

    const result = await checkPublicNameAvailability(userId, name);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error checking public name availability:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const reuploadDocumentsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files || {};
    const introVideoMediaId = req.body.introVideoMediaId
      ? parseInt(req.body.introVideoMediaId, 10)
      : null;

    const result = await reuploadCreatorDocuments(userId, files, introVideoMediaId);

    return res.status(200).json({
      message: "Documents re-uploaded successfully. Your profile has been resubmitted for review.",
      profile: result.profile,
      media: result.media,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error re-uploading creator documents:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

const updateIntroVideoController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({ field: path, message: msg }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const mediaId = parseInt(req.body.mediaId, 10);

    const updatedProfile = await updateCreatorIntroVideo(userId, mediaId);

    return res.status(200).json({
      message: "Intro video updated successfully.",
      profile: updatedProfile,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error updating intro video:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getProfile,
  getApprovedCreatorsList,
  checkPublicNameAvailabilityController,
  reuploadDocumentsController,
  updateIntroVideoController,
};
