const {
  createCampaign,
  updateCampaign,
  submitForPayment,
  getCampaignById,
  getBrandDrafts,
  getCampaignsByBrand,
  getPublicActiveCampaigns,
  deleteDraftCampaign,
  getInvoiceForCampaign,
} = require("../services/campaignService");
const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

const parseCampaignBody = (body) => {
  const parsed = { ...body };

  const jsonFields = ["platform", "location", "addOns", "ageRange", "gender", "creativeDirection"];
  jsonFields.forEach((field) => {
    if (parsed[field] && typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (_) {
        // Leave as-is; validator will catch invalid JSON
      }
    }
  });

  if (parsed.petsRequired === "true")  parsed.petsRequired = true;
  if (parsed.petsRequired === "false") parsed.petsRequired = false;

  // Coerce empty strings to null for optional nullable fields
  const nullableFields = [
    "numberOfCreators",
    "applicationDeadline",
    "campaignStarts",
    "moodboardInspirationUrl",
    "productServiceUrl",
    "typeOfPet",
    "giftNameDescription",
    "videoLength",
  ];
  nullableFields.forEach((field) => {
    if (parsed[field] === "") parsed[field] = null;
  });

  return parsed;
};


const getValidationErrors = (req) => {
  const result = validationResult(req).formatWith(({ msg, path }) => ({ field: path, message: msg }));
  return result.isEmpty() ? null : result.array();
};


const handleError = (err, res, context) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(`[campaignController] ${context}:`, err.message);
  return res.status(500).json({ error: "Something went wrong. Please try again later." });
};


const createCampaignController = async (req, res) => {
  const errors = getValidationErrors(req);
  if (errors) return res.status(400).json({ errors });

  try {
    const userId  = req.user.id;
    const brandId = req.brandId;
    const campaignData = parseCampaignBody(req.body);
    const files = req.files || {};

    const result = await createCampaign(userId, brandId, campaignData, files);

    return res.status(201).json({
      message: "Campaign saved as draft successfully.",
      ...result,
    });
  } catch (err) {
    return handleError(err, res, "createCampaign");
  }
};

const updateCampaignController = async (req, res) => {
  const errors = getValidationErrors(req);
  if (errors) return res.status(400).json({ errors });

  try {
    const userId   = req.user.id;
    const brandId  = req.brandId;
    const publicId = req.params.publicId;
    const files    = req.files || {};
    const updates  = parseCampaignBody(req.body);

    const result = await updateCampaign(userId, brandId, publicId, updates, files);

    return res.status(200).json({
      message: "Campaign updated successfully.",
      ...result,
    });
  } catch (err) {
    return handleError(err, res, "updateCampaign");
  }
};

const submitForPaymentController = async (req, res) => {
  try {
    const userId   = req.user.id;
    const brandId  = req.brandId;
    const publicId = req.params.publicId;

    const result = await submitForPayment(userId, brandId, publicId);

    return res.status(200).json({
      message: "Campaign is ready for payment. Redirect the brand to the payment gateway.",
      ...result,
    });
  } catch (err) {
    return handleError(err, res, "submitForPayment");
  }
};

const getCampaignByIdController = async (req, res) => {
  try {
    const publicId = req.params.publicId;
    const campaign = await getCampaignById(publicId);
    if (!campaign) throw new AppError("Campaign not found.", 404);
    return res.status(200).json({ campaign });
  } catch (err) {
    return handleError(err, res, "getCampaignById");
  }
};

const getBrandDraftsController = async (req, res) => {
  try {
    const brandId = req.brandId;
    const { page = 1, limit = 10 } = req.query;

    const result = await getBrandDrafts(brandId, page, limit);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, res, "getBrandDrafts");
  }
};

const getCampaignsByBrandController = async (req, res) => {
  try {
    const brandId = req.brandId;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await getCampaignsByBrand(brandId, status, page, limit);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, res, "getCampaignsByBrand");
  }
};

const getPublicActiveCampaignsController = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getPublicActiveCampaigns(page, limit);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, res, "getPublicActiveCampaigns");
  }
};

const deleteDraftCampaignController = async (req, res) => {
  try {
    const publicId = req.params.publicId;
    const brandId  = req.brandId;

    await deleteDraftCampaign(publicId, brandId);
    return res.status(200).json({ message: "Draft campaign deleted successfully." });
  } catch (err) {
    return handleError(err, res, "deleteDraftCampaign");
  }
};

const getInvoiceController = async (req, res) => {
  try {
    const publicId = req.params.publicId;
    const brandId  = req.brandId;

    const invoice = await getInvoiceForCampaign(publicId, brandId);

    if (!invoice) {
      return res.status(200).json({
        invoice: null,
        message: "No invoice has been generated yet. Ensure videoLength is set and the campaign has been saved.",
      });
    }

    return res.status(200).json({ invoice });
  } catch (err) {
    return handleError(err, res, "getInvoice");
  }
};


module.exports = {
  createCampaignController,
  updateCampaignController,
  submitForPaymentController,
  getCampaignByIdController,
  getBrandDraftsController,
  getCampaignsByBrandController,
  getPublicActiveCampaignsController,
  deleteDraftCampaignController,
  getInvoiceController,
};
