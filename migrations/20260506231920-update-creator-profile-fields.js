"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {

      const columnsToRemove = [
        "addressLine1",
        "addressLine2",
        "country",
        "postalZipCode",
        "portfolioUrl"
      ];

      for (const col of columnsToRemove) {
        await queryInterface.removeColumn("CreatorProfiles", col, { transaction });
      }

      const newColumns = {
        publicName: { type: Sequelize.STRING, allowNull: true },
        dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
        isSouthAfricanCitizen: { type: Sequelize.BOOLEAN, allowNull: true },
        saIdNumber: { type: Sequelize.STRING, allowNull: true },
        passportNumber: { type: Sequelize.STRING, allowNull: true },
        province: { type: Sequelize.STRING, allowNull: true },
        streetNumber: { type: Sequelize.STRING, allowNull: true },
        primaryNiches: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
        secondaryNiches: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
        gender: { type: Sequelize.STRING, allowNull: true },
        hasPets: { type: Sequelize.BOOLEAN, allowNull: true },
        hasChildren: { type: Sequelize.BOOLEAN, allowNull: true },
        youtubeChannelUrl: { type: Sequelize.STRING, allowNull: true },
        skillsUrl: { type: Sequelize.STRING, allowNull: true }
      };

      for (const [columnName, columnDef] of Object.entries(newColumns)) {
        await queryInterface.addColumn("CreatorProfiles", columnName, columnDef, { transaction });
      }

      
      await queryInterface.sequelize.query(
        `ALTER TABLE "CreatorProfiles" 
         ALTER COLUMN "appearance" TYPE VARCHAR(255)[] 
         USING CASE WHEN "appearance" IS NULL THEN NULL ELSE ARRAY["appearance"]::VARCHAR(255)[] END;`,
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
     
      const oldColumns = {
        addressLine1: { type: Sequelize.STRING, allowNull: true },
        addressLine2: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: false, defaultValue: 'South Africa' }, // Default value added to avoid non-null constraint issues during rollback
        postalZipCode: { type: Sequelize.STRING, allowNull: true },
        portfolioUrl: { type: Sequelize.STRING, allowNull: true }
      };

      for (const [columnName, columnDef] of Object.entries(oldColumns)) {
        await queryInterface.addColumn("CreatorProfiles", columnName, columnDef, { transaction });
      }

      
      await queryInterface.addIndex("CreatorProfiles", ["country"], {
        name: "idx_creator_country",
        transaction
      });

      
      const addedColumns = [
        "publicName", "dateOfBirth", "isSouthAfricanCitizen", "saIdNumber", 
        "passportNumber", "province", "streetNumber", "primaryNiches", 
        "secondaryNiches", "gender", "hasPets", "hasChildren", "youtubeChannelUrl", "skillsUrl"
      ];

      for (const col of addedColumns) {
        await queryInterface.removeColumn("CreatorProfiles", col, { transaction });
      }

     
      await queryInterface.sequelize.query(
        `ALTER TABLE "CreatorProfiles" 
         ALTER COLUMN "appearance" TYPE VARCHAR(255) 
         USING CASE WHEN "appearance" IS NULL OR array_length("appearance", 1) IS NULL THEN NULL ELSE "appearance"[1] END;`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
