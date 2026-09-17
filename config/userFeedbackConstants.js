const USER_FEEDBACK_TYPES = {
  BUG: "bug",
  FEEDBACK: "feedback",
};

const USER_FEEDBACK_STATUSES = ["new", "in_progress", "resolved"];

const getRecipientEmailForUserFeedback = () => {
  return (
    process.env.USER_FEEDBACK_ADMIN_EMAIL ||
    process.env.ADMIN_CONTACT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@creatrend.co.za"
  );
};

module.exports = {
  USER_FEEDBACK_TYPES,
  USER_FEEDBACK_STATUSES,
  getRecipientEmailForUserFeedback,
};
