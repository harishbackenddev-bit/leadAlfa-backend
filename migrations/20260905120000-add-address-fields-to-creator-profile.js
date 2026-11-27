"use strict";

/**
 * Migration: add-address-fields-to-creator-profile
 *
 * Adds the following columns to the CreatorProfiles table:
 *   - addressLine1         (STRING, NULL)  — primary street address
 *   - addressLine2         (STRING, NULL)  — optional secondary line (apt, building)
 *   - suburb               (STRING, NULL)  — SA suburb, e.g. "Sea Point"
 *   - postalCode           (STRING(10), NULL) — 4-digit SA postal code stored as string
 *   - deliveryInstructions (TEXT, NULL)    — optional free-text delivery notes
 *
 * All columns are allowNull: true so existing CreatorProfile records are
 * not modified, backfilled, or assigned fake default values.
 *
 * Mandatory-on-creation enforcement is at the service/validation layer.
 *
 * NOT re-adding: city, province (already exist in schema).
 * NOT removing:  streetNumber (preserved for backward compatibility).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        "CreatorProfiles",
        "addressLine1",
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "CreatorProfiles",
        "addressLine2",
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "CreatorProfiles",
        "suburb",
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "CreatorProfiles",
        "postalCode",
        { type: Sequelize.STRING(10), allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        "CreatorProfiles",
        "deliveryInstructions",
        { type: Sequelize.TEXT, allowNull: true },
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn("CreatorProfiles", "deliveryInstructions", { transaction });
      await queryInterface.removeColumn("CreatorProfiles", "postalCode", { transaction });
      await queryInterface.removeColumn("CreatorProfiles", "suburb", { transaction });
      await queryInterface.removeColumn("CreatorProfiles", "addressLine2", { transaction });
      await queryInterface.removeColumn("CreatorProfiles", "addressLine1", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
