"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [duplicates] = await queryInterface.sequelize.query(
        `
        SELECT LOWER(TRIM("publicName")) AS normalized_name, COUNT(*) AS count
        FROM "CreatorProfiles"
        WHERE "isDeleted" = false 
          AND "publicName" IS NOT NULL 
          AND TRIM("publicName") != ''
        GROUP BY LOWER(TRIM("publicName"))
        HAVING COUNT(*) > 1;
        `,
        { transaction }
      );

      if (duplicates && duplicates.length > 0) {
        const duplicateList = duplicates
          .map((d) => `"${d.normalized_name}" (count: ${d.count})`)
          .join(", ");
        throw new Error(
          `Cannot apply unique index on CreatorProfiles.publicName: duplicate active names detected: ${duplicateList}. Please resolve duplicates manually before running this migration.`
        );
      }

      await queryInterface.sequelize.query(
        `
        CREATE UNIQUE INDEX "idx_creator_profile_public_name_unique"
        ON "CreatorProfiles" (LOWER(TRIM("publicName")))
        WHERE "isDeleted" = false 
          AND "publicName" IS NOT NULL 
          AND TRIM("publicName") != '';
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS "idx_creator_profile_public_name_unique";`,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
