const brevoProvider = require("./providers/brevoProvider");
const verificationEmail = require("./templates/verificationEmail");
const passwordReset = require("./templates/passwordReset");
const resendVerificationEmail = require("./templates/resendVerificationEmail");
const profileApprovedEmail = require("./templates/profileApprovedEmail");
const profileRejectedEmail = require("./templates/profileRejectedEmail");
const profileClarificationEmail = require("./templates/profileClarificationEmail");
const shipmentBookedCreator = require("./templates/shipmentBookedCreator");
const shipmentBookedBrand = require("./templates/shipmentBookedBrand");
const shipmentStatusCreator = require("./templates/shipmentStatusCreator");
const contactRequestNotificationEmail = require("./templates/contactRequestNotificationEmail");
const bookCallRequestNotificationEmail = require("./templates/bookCallRequestNotificationEmail");
const userFeedbackNotificationEmail = require("./templates/userFeedbackNotificationEmail");
const { getRecipientEmailForInquiry, INQUIRY_CONFIG } = require("../../config/contactConstants");
const { getRecipientEmailForBookCall } = require("../../config/bookCallConstants");
const { getRecipientEmailForUserFeedback } = require("../../config/userFeedbackConstants");

const PROVIDERS = { brevo: brevoProvider };
const activeProvider = process.env.EMAIL_PROVIDER || "brevo";

const getProvider = ()=>{
const provider = PROVIDERS[activeProvider];
  if (!provider) throw new Error(`Email provider "${activeProvider}" not configured`);
  return provider;
}

const sendVerificationEmail = async(to,verificationCode)=>{
  const {subject,text,html} = verificationEmail(verificationCode);
  return getProvider().sendEmail({to,subject,text,html});
}

const sendPasswordResetEmail = async(to,resetToken)=>{
  const ttl = Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 15;
  const resetLink=`${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const {subject,text,html} = passwordReset(resetLink, ttl);
  return getProvider().sendEmail({to,subject,text,html});
}

const sendReVerificationEmail = async(to,verificationCode)=>{
  const {subject,text,html} = resendVerificationEmail(verificationCode);
  return getProvider().sendEmail({to,subject,text,html});
}

const sendProfileApprovedEmail = async (to, name, profileType = "Creator") => {
  const { subject, text, html } = profileApprovedEmail(name, profileType);
  return getProvider().sendEmail({ to, subject, text, html });
};

const sendProfileRejectedEmail = async (to, name, reason, profileType = "Creator") => {
  const { subject, text, html } = profileRejectedEmail(name, reason, profileType);
  return getProvider().sendEmail({ to, subject, text, html });
};

const sendProfileClarificationEmail = async (to, name, message, profileType = "Creator", actionUrl = null) => {
  const { subject, text, html, replyTo } = profileClarificationEmail(name, message, profileType, actionUrl);
  return getProvider().sendEmail({ to, subject, text, html, replyTo });
};

const sendShipmentBookedCreatorEmail = async (to, details) => {
  const { subject, text, html } = shipmentBookedCreator(details);
  return getProvider().sendEmail({ to, subject, text, html });
};

const sendShipmentBookedBrandEmail = async (to, details) => {
  const { subject, text, html } = shipmentBookedBrand(details);
  return getProvider().sendEmail({ to, subject, text, html });
};

const sendShipmentStatusCreatorEmail = async (to, details) => {
  const copy = shipmentStatusCreator(details);
  if (!copy) return null;
  return getProvider().sendEmail({ to, ...copy });
};
const sendBrandProfileApprovedEmail = async (to, companyName) => {
  return sendProfileApprovedEmail(to, companyName, "Brand");
};

const sendBrandProfileRejectedEmail = async (to, companyName, reason) => {
  return sendProfileRejectedEmail(to, companyName, reason, "Brand");
};

const sendBrandProfileClarificationEmail = async (to, companyName, message, actionUrl = null) => {
  return sendProfileClarificationEmail(to, companyName, message, "Brand", actionUrl);
};

const sendAdminContactNotificationEmail = async ({
  name,
  email,
  inquiryType,
  message,
  publicId,
}) => {
  const recipientEmail = getRecipientEmailForInquiry(inquiryType);
  const inquiryLabel = INQUIRY_CONFIG[inquiryType]?.label || inquiryType;
  const { subject, text, html } = contactRequestNotificationEmail({
    name,
    email,
    inquiryLabel,
    message,
    publicId,
  });
  return getProvider().sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    replyTo: email,
  });
};

const sendAdminBookCallNotificationEmail = async ({
  name,
  businessEmail,
  companyName,
  companyWebsite,
  publicId,
  createdAt,
}) => {
  const recipientEmail = getRecipientEmailForBookCall();
  const { subject, text, html } = bookCallRequestNotificationEmail({
    name,
    businessEmail,
    companyName,
    companyWebsite,
    publicId,
    createdAt,
  });
  return getProvider().sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    replyTo: businessEmail,
  });
};

const sendAdminUserFeedbackNotificationEmail = async ({
  publicId,
  type,
  description,
  pageUrl,
  userName,
  userEmail,
  createdAt,
}) => {
  const recipientEmail = getRecipientEmailForUserFeedback();
  const { subject, text, html } = userFeedbackNotificationEmail({
    publicId,
    type,
    description,
    pageUrl,
    userName,
    userEmail,
    createdAt,
  });
  return getProvider().sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    replyTo: userEmail,
  });
};

module.exports = { 
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReVerificationEmail,
  sendProfileApprovedEmail,
  sendProfileRejectedEmail,
  sendProfileClarificationEmail,
  sendShipmentBookedCreatorEmail,
  sendShipmentBookedBrandEmail,
  sendShipmentStatusCreatorEmail,
  sendBrandProfileApprovedEmail,
  sendBrandProfileRejectedEmail,
  sendBrandProfileClarificationEmail,
  sendAdminContactNotificationEmail,
  sendAdminBookCallNotificationEmail,
  sendAdminUserFeedbackNotificationEmail,
};
