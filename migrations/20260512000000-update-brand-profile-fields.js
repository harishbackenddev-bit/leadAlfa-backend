"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn("BrandProfiles", "postalZipCode", { transaction });
      
      await queryInterface.addColumn("BrandProfiles", "businessType", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });
      
      await queryInterface.addColumn("BrandProfiles", "jobRole", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });
      
      await queryInterface.addColumn("BrandProfiles", "brandPrimaryIndustry", {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      }, { transaction });
      
      await queryInterface.addColumn("BrandProfiles", "bio", {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });
      
      await queryInterface.addColumn("BrandProfiles", "companyRegistrationNumber", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("BrandProfiles", "postalZipCode", {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.removeColumn("BrandProfiles", "businessType", { transaction });
      await queryInterface.removeColumn("BrandProfiles", "jobRole", { transaction });
      await queryInterface.removeColumn("BrandProfiles", "brandPrimaryIndustry", { transaction });
      await queryInterface.removeColumn("BrandProfiles", "bio", { transaction });
      await queryInterface.removeColumn("BrandProfiles", "companyRegistrationNumber", { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
