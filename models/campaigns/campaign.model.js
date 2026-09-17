const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const crypto = require("crypto");

const Campaign = sequelize.define(
  "Campaign",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "BrandProfiles", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    publicId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    campaignTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    deliverables: {
      type: DataTypes.STRING,
      allowNull: false,
      comment:
        "e.g., 1x video (9:16, 15-30 seconds), 3x Photos + 1x Video (9:16), etc.",
    },

    platform: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "Multiple selections: Tiktok Native, Instagram Reels, Youtube Shorts, Cross Platform",
    },

    location: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Multiple selections: South Africa, United Kingdom, Australia, etc.",
    },

    numberOfCreators: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    productServiceUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isUrl: true },
    },

    addOns: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "Array of validated add-on keys e.g. ['raw_footage','extra_hooks']. Keys must exist in pricingConstants.ADD_ONS.",
    },

    videoLength: {
      type: DataTypes.ENUM("15sec", "30sec", "60sec"),
      allowNull: true,
      comment: "Video length package selected in Step 1. Required for invoice calculation (Cash campaigns only).",
    },

    ageRange: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Multiple selections: 13-17, 18-24, 25-34, 35-44, 45-54, 55+",
    },

    gender: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Multiple selections: Male, Female, Non-binary, All Genders",
    },

    productStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Single selection: Gifted, Reimbursement",
    },

    compensationType: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "Cash",
      comment: "'Cash' (default — triggers invoice flow) or 'Gift' (requires subscription + giftNameDescription).",
    },

    giftNameDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Required when compensationType is 'Gift'.",
    },

    campaignGoal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    followerCount: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Single selection: 1k-10k, 10k-50k, etc.",
    },

    engagementRate: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Single selection: 1%-2%, 2%-5%, etc.",
    },

    keyMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    campaignBrief: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    creativeDirection: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Object: { hookStyle, toneVoice, problem, solution, callToAction, aestheticVibes, scriptingApproach }",
    },

    applicationDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    campaignStarts: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    petsRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },

    typeOfPet: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Only required if petsRequired is true",
    },

    moodboardsInspiration: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Single selection: 'URL' or 'Upload Images'",
    },

    moodboardInspirationUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isUrl: true },
    },

    // ============================================================
    // ✅ NEW: Campaign Funding Fields
    // ============================================================
    fundingStatus: {
      type: DataTypes.ENUM(
        "UNFUNDED",
        "AWAITING_FUNDING",
        "FUNDS_RECEIVED",
        "FUNDED",
        "REFUNDED"
      ),
      defaultValue: "UNFUNDED",
      allowNull: false,
      comment: "Tracks brand funding lifecycle. Only FUNDS_RECEIVED/FUNDED campaigns are allowed to go live.",
    },

    campaignBudgetCents: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      comment: "Total creator budget in cents (from invoice.cartSubtotal).",
    },

    availableBudgetCents: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      comment: "Unallocated balance available for new creator selections.",
    },

    reservedBudgetCents: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      comment: "Amount reserved for creator selections awaiting escrow funding.",
    },

    committedBudgetCents: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      comment: "Amount locked in funded escrow transactions.",
    },

    tradeSafeWalletTokenId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Brand's TradeSafe token ID used for funding this campaign.",
    },

    fundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when campaign funding was confirmed.",
    },

    status: {
      type: DataTypes.ENUM("inactive", "active", "closed"),
      allowNull: false,
      defaultValue: "inactive",
    },

    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "Campaigns",
    timestamps: true,
    indexes: [
      { fields: ["publicId"], unique: true, name: "idx_campaign_publicId" },
      { fields: ["brandId"], name: "idx_campaign_brandId" },
      { fields: ["status"], name: "idx_campaign_status" },
      { fields: ["isDeleted"], name: "idx_campaign_isDeleted" },
      { fields: ["fundingStatus"], name: "idx_campaign_fundingStatus" },
    ],
  }
);

Campaign.beforeValidate((campaign, options) => {
  if (!campaign.publicId) {
    campaign.publicId = `CMP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

Campaign.associate = (models) => {
  Campaign.belongsTo(models.BrandProfile, {
    foreignKey: "brandId",
    as: "brand",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Campaign.hasMany(models.CampaignMedia, {
    foreignKey: "campaignId",
    as: "mediaLinks",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Campaign.hasMany(models.CampaignInvitation, {
    foreignKey: "campaignId",
    as: "invitations",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Campaign.hasOne(models.CampaignInvoice, {
    foreignKey: "campaignId",
    as: "invoice",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = Campaign;