'use strict';

/**
 * Old flow: POST /campaigns/:id/publish set the invoice to "pending" BEFORE the
 * brand had paid. If the brand closed the TradeSafe tab the draft stayed
 * "pending" forever (could not be re-priced, re-paid or deleted).
 *
 * Reset every such draft back to "unpaid". Paid / funded campaigns are untouched.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "CampaignInvoices" ci
      SET "paymentStatus" = 'unpaid', "updatedAt" = NOW()
      FROM "Campaigns" c
      WHERE ci."campaignId" = c.id
        AND ci."paymentStatus" = 'pending'
        AND c."status" = 'inactive'
        AND c."fundingStatus" NOT IN ('FUNDS_RECEIVED', 'FUNDED');
    `);
  },

  async down() {
    // Irreversible data fix - nothing to roll back.
  },
};
