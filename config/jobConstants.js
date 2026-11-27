const JOB_STATUSES = [
  "ongoing",
  "submitted",
  "approved",
  "completed",
  "cancelled",
];

const HIRING_SOURCES = {
  CAMPAIGN_APPLICATION: "campaign_application",
  DIRECT_INVITATION: "direct_invitation",
};

const DEFAULT_JOB_DEADLINE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

module.exports = {
  JOB_STATUSES,
  HIRING_SOURCES,
  DEFAULT_JOB_DEADLINE_DAYS,
  MS_PER_DAY,
};
