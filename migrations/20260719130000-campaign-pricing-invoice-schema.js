"use strict";


/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        "Campaigns",
        "videoLength",
        {
          type: Sequelize.ENUM("15sec", "30sec", "60sec"),
          allowNull: true, 
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "Campaigns" ALTER COLUMN "status" SET DEFAULT 'inactive';`,
        { transaction }
      );

      const legacyColumns = [
        "usageRightsIncluded",
        "minBudget",
        "maxBudget",
        "whitelistingSparkAds",
        "additionalAudienceDetails",
        "dos",
        "donts",
      ];

      for (const col of legacyColumns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "Campaigns" DROP COLUMN IF EXISTS "${col}";`,
          { transaction }
        );
      }

      await queryInterface.createTable(
        "CampaignInvoices",
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },

          publicId: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },

          campaignId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: true,
            references: { model: "Campaigns", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          videoLength: {
            type: Sequelize.ENUM("15sec", "30sec", "60sec"),
            allowNull: false,
          },

          numberOfCreators: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },

          appliedAddOns: {
            type: Sequelize.JSON,
            allowNull: true,
          },

          basePackagePrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          basePackageTotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          addOnsPercentage: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          addOnsAmount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
          },
          cartSubtotal:     { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          serviceFeeAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          amountBeforeTax:  { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          vatAmount:        { type: Sequelize.DECIMAL(10, 2), allowNull: false },
          totalAmountDue:   { type: Sequelize.DECIMAL(10, 2), allowNull: false },

          paymentStatus: {
            type: Sequelize.ENUM("unpaid", "pending", "paid", "failed"),
            allowNull: false,
            defaultValue: "unpaid",
          },

          paidAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          gatewayReference: {
            type: Sequelize.STRING,
            allowNull: true,
          },

          gatewayPayload: {
            type: Sequelize.JSON,
            allowNull: true,
          },

          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },

          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("CampaignInvoices", ["publicId"], {
        unique: true,
        name: "idx_invoice_publicId",
        transaction,
      });

      await queryInterface.addIndex("CampaignInvoices", ["campaignId"], {
        unique: true,
        name: "idx_invoice_campaignId",
        transaction,
      });

      await queryInterface.addIndex("CampaignInvoices", ["paymentStatus"], {
        name: "idx_invoice_paymentStatus",
        transaction,
      });

      await queryInterface.addIndex("CampaignInvoices", ["gatewayReference"], {
        name: "idx_invoice_gatewayReference",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.dropTable("CampaignInvoices", { transaction });

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_CampaignInvoices_videoLength";`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_CampaignInvoices_paymentStatus";`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "Campaigns" ALTER COLUMN "status" SET DEFAULT 'active';`,
        { transaction }
      );

      await queryInterface.removeColumn("Campaigns", "videoLength", { transaction });
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_Campaigns_videoLength";`,
        { transaction }
      );

      const legacyCols = [
        { name: "usageRightsIncluded",    type: Sequelize.STRING },
        { name: "minBudget",              type: Sequelize.DECIMAL(10, 2) },
        { name: "maxBudget",              type: Sequelize.DECIMAL(10, 2) },
        { name: "whitelistingSparkAds",   type: Sequelize.STRING },
        { name: "additionalAudienceDetails", type: Sequelize.TEXT },
        { name: "dos",                    type: Sequelize.TEXT },
        { name: "donts",                  type: Sequelize.TEXT },
      ];

      for (const { name, type } of legacyCols) {
        await queryInterface.addColumn(
          "Campaigns",
          name,
          { type, allowNull: true },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
