'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_BrandProfiles_status" ADD VALUE IF NOT EXISTS 'clarification_requested';`
        );
      } catch (e) {
        console.warn("Enum type alter warning:", e.message);
      }
    }

    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.changeColumn('BrandProfiles', 'status', {
        type: Sequelize.ENUM('draft', 'pending', 'approved', 'rejected', 'clarification_requested'),
        allowNull: true,
        defaultValue: 'pending'
      }, { transaction: t });

      await queryInterface.addColumn('BrandProfiles', 'rejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('BrandProfiles', 'reviewedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });

      await queryInterface.addColumn('BrandProfiles', 'reviewedAt', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('BrandProfiles', 'clarificationRequested', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }, { transaction: t });

      await queryInterface.addColumn('BrandProfiles', 'isDeleted', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }, { transaction: t });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('BrandProfiles', 'rejectionReason', { transaction: t });
      await queryInterface.removeColumn('BrandProfiles', 'reviewedBy', { transaction: t });
      await queryInterface.removeColumn('BrandProfiles', 'reviewedAt', { transaction: t });
      await queryInterface.removeColumn('BrandProfiles', 'clarificationRequested', { transaction: t });
      await queryInterface.removeColumn('BrandProfiles', 'isDeleted', { transaction: t });
    });
  }
};
