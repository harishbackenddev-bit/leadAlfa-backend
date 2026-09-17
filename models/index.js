const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");

const CreatorProfile = require("./creatorProfile/creatorProfile.model");
const Category = require("./creatorProfile/category.model");
const Skill = require("./creatorProfile/skill.model");
const CreatorMedia = require("./creatorProfile/creatorMedia.model");
const Media = require("./media/media.model");
const User = require("./user.model");
const CreatorCategory = require("./creatorProfile/creatorCategory.model");
const CreatorSkill = require("./creatorProfile/creatorSkill.model");
const BrandProfile = require("./brandProfile/brandProfile.model");
const BrandMedia = require("./brandProfile/brandMedia.model");
const Campaign = require("./campaigns/campaign.model");
const CampaignMedia = require("./campaigns/campaignMedia.model");
const CampaignApplication = require("./campaigns/campaignApplication.model");
const CampaignApplicationMedia = require("./campaigns/campaignApplicationMedia.model");
const CampaignInvoice = require("./campaigns/campaignInvoice.model");
const CreatorJob = require("./jobs/creatorJob.model");
const CampaignInvitation = require("./campaigns/campaignInvitation.model");
const ChatRoom = require("./chat/chatRoom.model");
const Message = require("./chat/message.model");
const MessageReadStatus = require("./chat/messageReadStatus.model");
const ChatMessageMedia = require("./chat/chatMessageMedia.model");
const CreatorSocialAccount = require("./socialAccounts/creatorSocialAccount.model");
const WorkSubmission = require("./submissions/workSubmission.model");
const SubmissionRevision = require("./submissions/submissionRevision.model");
const SubmissionAsset = require("./submissions/submissionAsset.model");
const CampaignActivityLog = require("./activity/campaignActivityLog.model");
const Shipment = require("./shipping/shipment.model");
const ShippingAddress = require("./shipping/shippingAddress.model");
const ContactRequest = require("./contactRequest.model");
const BookCallRequest = require("./bookCallRequest.model");
const UserFeedback = require("./userFeedback.model");

// ✅ ADD THESE TWO
const Transaction = require("./transaction/transaction.model");
const FundingBatch = require("./transaction/fundingBatch.model");

const db = {
  sequelize,
  Sequelize,
  CreatorProfile,
  Category,
  Skill,
  CreatorMedia,
  Media,
  User,
  CreatorCategory,
  CreatorSkill,
  BrandProfile,
  BrandMedia,
  Campaign,
  CampaignMedia,
  CampaignApplication,
  CampaignApplicationMedia,
  CampaignInvoice,
  CreatorJob,
  CampaignInvitation,
  ChatRoom,
  Message,
  MessageReadStatus,
  ChatMessageMedia,
  CreatorSocialAccount,
  WorkSubmission,
  SubmissionRevision,
  SubmissionAsset,
  CampaignActivityLog,
  Shipment,
  ShippingAddress,
  ContactRequest,
  BookCallRequest,
  UserFeedback,
  // ✅ ADD THESE
  Transaction,
  FundingBatch,
};

Object.keys(db).forEach((modelName) => {
  if (db[modelName] && db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;