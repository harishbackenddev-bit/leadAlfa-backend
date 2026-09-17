"use strict";

const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const { getCampaignActivity } = require("../services/campaignActivityService");

const getCampaignActivityController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { campaignPublicId } = req.params;
    const brandId = req.brandId;
    const { page, limit, eventType } = req.query;

    const result = await getCampaignActivity(campaignPublicId, brandId, {
      page,
      limit,
      eventType,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching campaign activity:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

module.exports = { getCampaignActivityController };
