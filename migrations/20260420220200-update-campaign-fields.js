"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Drop old columns
      await queryInterface.removeColumn("Campaigns", "videoAspectRatio", { transaction });
      await queryInterface.removeColumn("Campaigns", "videoLength", { transaction });
      await queryInterface.removeColumn("Campaigns", "budgetValue", { transaction });
      await queryInterface.removeColumn("Campaigns", "campaignRules", { transaction });
      await queryInterface.removeColumn("Campaigns", "socialMediaType", { transaction });
      await queryInterface.removeColumn("Campaigns", "additionalBrief", { transaction });

      // 2. Rename columns
      await queryInterface.renameColumn("Campaigns", "countryPreferences", "location", { transaction });
      await queryInterface.renameColumn("Campaigns", "creatorsNeeded", "numberOfCreators", { transaction });
      await queryInterface.renameColumn("Campaigns", "productUrl", "productServiceUrl", { transaction });

      // 3. Alter "deliverables" from ENUM to VARCHAR and drop legacy ENUM types
      await queryInterface.sequelize.query(
        'ALTER TABLE "Campaigns" ALTER COLUMN "deliverables" TYPE VARCHAR(255) USING "deliverables"::varchar;',
        { transaction }
      );
      
      // Explicitly drop Postgres ENUM types left behind by removed/altered columns
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Campaigns_socialMediaType";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Campaigns_videoAspectRatio";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Campaigns_deliverables";', { transaction });

      // 4. Add new replacement/additional columns exactly matched to model
      const newColumns = {
        platform: { type: Sequelize.JSON, allowNull: true },
        addOns: { type: Sequelize.JSON, allowNull: true },
        ageRange: { type: Sequelize.JSON, allowNull: true },
        gender: { type: Sequelize.JSON, allowNull: true },
        usageRightsIncluded: { type: Sequelize.STRING, allowNull: true },
        productStatus: { type: Sequelize.STRING, allowNull: true },
        compensationType: { type: Sequelize.STRING, allowNull: true },
        minBudget: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        maxBudget: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        giftNameDescription: { type: Sequelize.TEXT, allowNull: true },
        whitelistingSparkAds: { type: Sequelize.STRING, allowNull: true },
        campaignGoal: { type: Sequelize.TEXT, allowNull: true },
        followerCount: { type: Sequelize.STRING, allowNull: true },
        engagementRate: { type: Sequelize.STRING, allowNull: true },
        additionalAudienceDetails: { type: Sequelize.TEXT, allowNull: true },
        keyMessage: { type: Sequelize.TEXT, allowNull: true },
        creativeDirection: { type: Sequelize.JSON, allowNull: true },
        dos: { type: Sequelize.TEXT, allowNull: true },
        donts: { type: Sequelize.TEXT, allowNull: true },
        applicationDeadline: { type: Sequelize.DATE, allowNull: true },
        campaignStarts: { type: Sequelize.DATE, allowNull: true },
        petsRequired: { type: Sequelize.BOOLEAN, allowNull: true },
        typeOfPet: { type: Sequelize.STRING, allowNull: true },
        moodboardsInspiration: { type: Sequelize.STRING, allowNull: true },
        moodboardInspirationUrl: { type: Sequelize.STRING, allowNull: true }
      };

      for (const [columnName, columnDef] of Object.entries(newColumns)) {
        await queryInterface.addColumn("Campaigns", columnName, columnDef, { transaction });
      }

      // 5. Add isDeleted
      await queryInterface.addColumn("Campaigns", "isDeleted", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction });

      // 6. Add publicId (Step 1: Allow Null)
      await queryInterface.addColumn("Campaigns", "publicId", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      // 7. Backfill publicId for existing rows
      const [campaigns] = await queryInterface.sequelize.query('SELECT id FROM "Campaigns";', { transaction });
      const crypto = require("crypto");
      for (const campaign of campaigns) {
        const uniqueId = `CMP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        await queryInterface.sequelize.query(
          `UPDATE "Campaigns" SET "publicId" = '${uniqueId}' WHERE id = ${campaign.id};`,
          { transaction }
        );
      }

      // 8. Lock down publicId (AllowNull: false, Unique: true)
      await queryInterface.changeColumn("Campaigns", "publicId", {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Re-add dropped columns
      await queryInterface.addColumn("Campaigns", "videoAspectRatio", { 
        type: Sequelize.ENUM("1:1", "4:5", "9:16", "16:9"), allowNull: true 
      }, { transaction });
      await queryInterface.addColumn("Campaigns", "videoLength", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn("Campaigns", "budgetValue", { type: Sequelize.DECIMAL(10, 2), allowNull: false }, { transaction });
      await queryInterface.addColumn("Campaigns", "campaignRules", { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await queryInterface.addColumn("Campaigns", "socialMediaType", { 
        type: Sequelize.ENUM("instagram", "tiktok", "facebook", "youtube"), allowNull: false 
      }, { transaction });
      await queryInterface.addColumn("Campaigns", "additionalBrief", { type: Sequelize.TEXT, allowNull: true }, { transaction });

      // 2. Rename back
      await queryInterface.renameColumn("Campaigns", "location", "countryPreferences", { transaction });
      await queryInterface.renameColumn("Campaigns", "numberOfCreators", "creatorsNeeded", { transaction });
      await queryInterface.renameColumn("Campaigns", "productServiceUrl", "productUrl", { transaction });

      // 3. Recreate ENUM type for deliverables if necessary and revert
      // (This requires raw query because Sequelize doesn't cleanly cast back String -> ENUM without type creation)
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Campaigns_deliverables" AS ENUM('image', 'video');`, { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "Campaigns" ALTER COLUMN "deliverables" TYPE "enum_Campaigns_deliverables" USING "deliverables"::"enum_Campaigns_deliverables";',
        { transaction }
      );

      // 4. Drop newly added columns
      const addedColumns = [
        "platform", "addOns", "ageRange", "gender", "usageRightsIncluded",
        "productStatus", "compensationType", "minBudget", "maxBudget",
        "giftNameDescription", "whitelistingSparkAds", "campaignGoal",
        "followerCount", "engagementRate", "additionalAudienceDetails",
        "keyMessage", "creativeDirection", "dos", "donts",
        "applicationDeadline", "campaignStarts", "petsRequired", "typeOfPet",
        "moodboardsInspiration", "moodboardInspirationUrl", "isDeleted", "publicId"
      ];

      for (const col of addedColumns) {
        await queryInterface.removeColumn("Campaigns", col, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
