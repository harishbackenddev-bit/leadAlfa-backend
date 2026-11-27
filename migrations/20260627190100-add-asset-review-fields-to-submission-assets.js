"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_type WHERE typname = 'enum_SubmissionAssets_reviewStatus'
         ) THEN
           CREATE TYPE "enum_SubmissionAssets_reviewStatus" AS ENUM ('approved', 'revision_requested', 'rejected');
         END IF;
       END
       $$;`
    );

    await queryInterface.addColumn("SubmissionAssets", "reviewStatus", {
      type: Sequelize.ENUM("approved", "revision_requested", "rejected"),
      allowNull: true,
      defaultValue: null,
      comment:
        "Informational indicator set by the brand when reviewing the parent revision. " +
        "NULL = not yet reviewed or brand chose not to annotate. " +
        "Does NOT create an independent asset review workflow.",
    });

    await queryInterface.addColumn("SubmissionAssets", "assetFeedback", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment:
        "Brand's specific comment on this individual asset. " +
        "Max 500 characters enforced at the service layer. " +
        "Only meaningful when reviewStatus is set.",
    });

    await queryInterface.addIndex(
      "SubmissionAssets",
      ["reviewStatus"],
      {
        name: "idx_submissionAsset_reviewStatus",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "SubmissionAssets",
      "idx_submissionAsset_reviewStatus"
    );

    await queryInterface.removeColumn("SubmissionAssets", "assetFeedback");
    await queryInterface.removeColumn("SubmissionAssets", "reviewStatus");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SubmissionAssets_reviewStatus";'
    );
  },
};
