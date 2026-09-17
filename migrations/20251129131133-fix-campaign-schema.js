"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
     await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Campaigns_brandId_key'
        ) THEN
          ALTER TABLE "Campaigns" DROP CONSTRAINT "Campaigns_brandId_key";
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'idx_campaign_brandId'
        ) THEN
          DROP INDEX "idx_campaign_brandId";
        END IF;
      END
      $$;
    `);

    await queryInterface.addIndex("Campaigns", ["brandId"], {
      name: "idx_campaign_brandId",
      unique: false,
    });
  },

  async down(queryInterface, Sequelize) {
   await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'idx_campaign_brandId'
        ) THEN
          DROP INDEX "idx_campaign_brandId";
        END IF;
      END
      $$;
    `);

    await queryInterface.addConstraint("Campaigns", {
      fields: ["brandId"],
      type: "unique",
      name: "Campaigns_brandId_key",
    });
  },
};
