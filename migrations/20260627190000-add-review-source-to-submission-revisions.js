"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_type WHERE typname = 'enum_SubmissionRevisions_reviewSource'
         ) THEN
           CREATE TYPE "enum_SubmissionRevisions_reviewSource" AS ENUM ('brand', 'system');
         END IF;
       END
       $$;`
    );

    await queryInterface.addColumn("SubmissionRevisions", "reviewSource", {
      type: Sequelize.ENUM("brand", "system"),
      allowNull: true,
      defaultValue: null,
      comment:
        "Audit field — how the review action was taken. 'brand' = manually by a brand user, 'system' = auto-approved by cron on deadline expiry. NULL = not yet reviewed.",
    });

    await queryInterface.addIndex(
      "SubmissionRevisions",
      ["reviewSource"],
      {
        name: "idx_submissionRevision_reviewSource",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "SubmissionRevisions",
      "idx_submissionRevision_reviewSource"
    );

    await queryInterface.removeColumn("SubmissionRevisions", "reviewSource");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SubmissionRevisions_reviewSource";'
    );
  },
};
