

/** Number of days the brand has to review a submission before it is overdue. */
const REVIEW_WINDOW_DAYS = 3;

/** Maximum number of times a brand can request a revision per submission. */
const MAX_REVISIONS = 2;

/** Minimum hours a creator must wait between sending reminders. */
const REMINDER_THROTTLE_HOURS = 24;

/** Maximum number of assets allowed per usageType per submission revision. */
const MAX_ASSETS_PER_TYPE = 5;

// ---------------------------------------------------------------------------
// Submission revision statuses
// ---------------------------------------------------------------------------

const REVISION_STATUSES = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REVISION_REQUESTED: "revision_requested",
  REJECTED: "rejected",
};

const REVISION_STATUS_VALUES = Object.values(REVISION_STATUSES);

// ---------------------------------------------------------------------------
// Asset usage types
// ---------------------------------------------------------------------------

const ASSET_USAGE_TYPES = {
  FINAL_VIDEO: "final_video",
  RAW_VIDEO: "raw_video",
  IMAGE: "image",
};

const ASSET_USAGE_TYPE_VALUES = Object.values(ASSET_USAGE_TYPES);

// ---------------------------------------------------------------------------
// Asset review statuses (informational only — set by brand on individual assets)
// ---------------------------------------------------------------------------

const ASSET_REVIEW_STATUSES = {
  APPROVED: "approved",
  REVISION_REQUESTED: "revision_requested",
  REJECTED: "rejected",
};

const ASSET_REVIEW_STATUS_VALUES = Object.values(ASSET_REVIEW_STATUSES);

// ---------------------------------------------------------------------------
// Review source — how a revision's review action was performed
// ---------------------------------------------------------------------------

const REVIEW_SOURCES = {
  BRAND: "brand",   // Manually reviewed by a brand user
  SYSTEM: "system", // Auto-approved by cron on deadline expiry
};

const REVIEW_SOURCE_VALUES = Object.values(REVIEW_SOURCES);

// ---------------------------------------------------------------------------
// Activity event types
// ---------------------------------------------------------------------------

const ACTIVITY_EVENT_TYPES = {
  // Campaign lifecycle
  CAMPAIGN_CREATED: "campaign_created",

  // Hiring pipeline
  CREATOR_HIRED: "creator_hired",
  INVITATION_SENT: "invitation_sent",
  INVITATION_ACCEPTED: "invitation_accepted",
  INVITATION_DECLINED: "invitation_declined",
  APPLICATION_RECEIVED: "application_received",
  APPLICATION_APPROVED: "application_approved",

  // Submission lifecycle
  SUBMISSION_CREATED: "submission_created",
  SUBMISSION_RESUBMITTED: "submission_resubmitted",
  SUBMISSION_APPROVED: "submission_approved",
  SUBMISSION_AUTO_APPROVED: "submission_auto_approved",
  REVISION_REQUESTED: "revision_requested",
  SUBMISSION_REJECTED: "submission_rejected",

  // Creator reminder
  REMINDER_SENT: "reminder_sent",

  // Job completion
  JOB_COMPLETED: "job_completed",
};

// ---------------------------------------------------------------------------
// Public ID prefixes
// ---------------------------------------------------------------------------

const PUBLIC_ID_PREFIXES = {
  WORK_SUBMISSION: "SUB",
  SUBMISSION_REVISION: "REV",
  SUBMISSION_ASSET: "AST",
};

module.exports = {
  REVIEW_WINDOW_DAYS,
  MAX_REVISIONS,
  REMINDER_THROTTLE_HOURS,
  MAX_ASSETS_PER_TYPE,
  REVISION_STATUSES,
  REVISION_STATUS_VALUES,
  ASSET_USAGE_TYPES,
  ASSET_USAGE_TYPE_VALUES,
  ASSET_REVIEW_STATUSES,
  ASSET_REVIEW_STATUS_VALUES,
  REVIEW_SOURCES,
  REVIEW_SOURCE_VALUES,
  ACTIVITY_EVENT_TYPES,
  PUBLIC_ID_PREFIXES,
};
