"use strict";

const { Op } = require("sequelize");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignActivityLog = require("../models/activity/campaignActivityLog.model");
const AppError = require("../utils/appError");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");


const ACTIVITY_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Campaign activity logging helper 
const logCampaignActivity = ({ campaignId, actorType, actorId, eventType, metadata }) => {
  const now = new Date();
  CampaignActivityLog.create({
    campaignId,
    actorType,
    actorId: actorId ?? null,
    eventType,
    metadata: metadata ?? null,
    expiresAt: new Date(now.getTime() + ACTIVITY_LOG_TTL_MS),
  }).catch((err) =>
    console.error(`[ActivityLog] Failed to write event "${eventType}":`, err.message)
  );
};


// Timeline label helper

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;


const computeTimelineLabel = (date) => {
  const diffMs = Date.now() - new Date(date).getTime();

  if (diffMs < MINUTE)       return "just now";
  if (diffMs < HOUR)         { const m = Math.floor(diffMs / MINUTE);  return `${m} minute${m > 1 ? "s" : ""} ago`; }
  if (diffMs < DAY)          { const h = Math.floor(diffMs / HOUR);    return `${h} hour${h > 1 ? "s" : ""} ago`; }
  if (diffMs < WEEK)         { const d = Math.floor(diffMs / DAY);     return `${d} day${d > 1 ? "s" : ""} ago`; }
  if (diffMs < MONTH)        { const w = Math.floor(diffMs / WEEK);    return `${w} week${w > 1 ? "s" : ""} ago`; }

  return "over a month ago";
};


const VALID_EVENT_TYPE_VALUES = Object.values(ACTIVITY_EVENT_TYPES);


// Service Methods

const getCampaignActivity = async (
  campaignPublicId,
  brandId,
  { page = 1, limit = 20, eventType } = {}
) => {

  if (eventType && !VALID_EVENT_TYPE_VALUES.includes(eventType)) {
    throw new AppError(
      `Invalid eventType. Must be one of: ${VALID_EVENT_TYPE_VALUES.join(", ")}.`,
      400
    );
  }

  const limitValue = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const pageValue  = Math.max(1, parseInt(page, 10) || 1);
  const offset     = (pageValue - 1) * limitValue;

  const campaign = await Campaign.findOne({
    where: { publicId: campaignPublicId, brandId, isDeleted: false },
    attributes: ["id", "campaignTitle"],
  });

  if (!campaign) {
    throw new AppError(
      "Campaign not found or you do not have permission to view its activity.",
      404
    );
  }

  const now = new Date();
  const where = {
    campaignId: campaign.id,
    expiresAt: { [Op.gt]: now }, 
  };
  if (eventType) {
    where.eventType = eventType;
  }

  const { count, rows } = await CampaignActivityLog.findAndCountAll({
    where,
    limit: limitValue,
    offset,
    order: [["createdAt", "DESC"]],
    attributes: ["id", "actorType", "actorId", "eventType", "metadata", "createdAt"],
  });

  const activity = rows.map((log) => ({
    id:            log.id,
    eventType:     log.eventType,
    actorType:     log.actorType,
    actorId:       log.actorId,
    metadata:      log.metadata,
    createdAt:     log.createdAt,
    timelineLabel: computeTimelineLabel(log.createdAt),
  }));

  return {
    activity,
    pagination: {
      totalItems:  count,
      totalPages:  limitValue > 0 ? Math.ceil(count / limitValue) : 0,
      currentPage: pageValue,
    },
  };
};

module.exports = { getCampaignActivity, logCampaignActivity };
