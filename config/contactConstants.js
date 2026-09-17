const CONTACT_STATUSES = ["new", "in_progress", "resolved"];

const INQUIRY_TYPES = {
  TALK_TO_SALES: "talk_to_sales",
  INQUIRE_ABOUT_CAREER: "inquire_about_career",
  ASK_GENERAL_QUESTION: "ask_general_question",
};

const INQUIRY_CONFIG = {
  [INQUIRY_TYPES.TALK_TO_SALES]: {
    label: "Talk to Sales",
    envKey: "CONTACT_EMAIL_SALES",
  },
  [INQUIRY_TYPES.INQUIRE_ABOUT_CAREER]: {
    label: "Inquire about Career",
    envKey: "CONTACT_EMAIL_CAREERS",
  },
  [INQUIRY_TYPES.ASK_GENERAL_QUESTION]: {
    label: "Ask a General Question",
    envKey: "CONTACT_EMAIL_GENERAL",
  },
};

const getRecipientEmailForInquiry = (inquiryType) => {
  const config = INQUIRY_CONFIG[inquiryType];
  const envVar = config ? process.env[config.envKey] : null;
  return (
    envVar ||
    process.env.ADMIN_CONTACT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@creatrend.co.za"
  );
};

module.exports = {
  CONTACT_STATUSES,
  INQUIRY_TYPES,
  INQUIRY_CONFIG,
  getRecipientEmailForInquiry,
};
