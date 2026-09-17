const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const { validateSouthAfricanPhone } = require("../../utils/phoneValidator");

const CreatorProfile = sequelize.define(
  "CreatorProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    publicName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    isSouthAfricanCitizen: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    saIdNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isNumeric: true,
        len: [13, 13],
      },
    },
    passportNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidSAPhone(value) {
          if (value) {
            const result = validateSouthAfricanPhone(value);
            if (!result.isValid) {
              throw new Error("Phone number must be a valid South African phone number");
            }
          }
        },
      },
    },
    province: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    streetNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    addressLine2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    suburb: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    postalCode: {
      type: DataTypes.STRING(10),
      allowNull: true, 
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ethnicity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    appearance: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: "List of languages (e.g., ['English', 'Hindi', 'French'])",
    },
    primaryNiches: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    secondaryNiches: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    hasPets: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    hasChildren: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },

    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instagramUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    tiktokUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    youtubeChannelUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    skillsUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: {
      type: DataTypes.ENUM("draft", "pending", "approved", "rejected", "clarification_requested"),
      defaultValue: "pending",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clarificationRequested: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: "CreatorProfiles",
    indexes: [
      { name: "idx_creator_email", fields: ["email"] },
      { name: "idx_creator_userId", fields: ["userId"], unique: true },
      { name: "idx_creator_status", fields: ["status"] },
    ],
  }
);

CreatorProfile.associate = (models) => {
  CreatorProfile.hasMany(models.CreatorMedia, {
    foreignKey: "creatorId",
    as: "mediaLinks",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CreatorProfile.belongsToMany(models.Category, {
    through: "CreatorCategories",
    foreignKey: "creatorId",
    otherKey: "categoryId",
    as: "categories",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CreatorProfile.belongsToMany(models.Skill, {
    through: "CreatorSkills",
    foreignKey: "creatorId",
    otherKey: "skillId",
    as: "skills",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CreatorProfile.belongsTo(models.User, {
    foreignKey: "userId",
    as: "userAccount",
    onDelete: "CASCADE",
  });

  CreatorProfile.belongsTo(models.User, {
    foreignKey: "reviewedBy",
    as: "reviewer",
    onDelete: "SET NULL",
  });

  CreatorProfile.hasMany(models.CampaignInvitation, {
    foreignKey: "creatorId",
    as: "invitations",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};

module.exports = CreatorProfile;
