'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_CreatorProfiles_status" ADD VALUE IF NOT EXISTS 'clarification_requested';`
        );
      } catch (e) {
        console.warn("Enum type alter warning:", e.message);
      }
    }

    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.changeColumn('CreatorProfiles', 'status', {
        type: Sequelize.ENUM('draft', 'pending', 'approved', 'rejected', 'clarification_requested'),
        allowNull: true,
        defaultValue: 'pending'
      }, { transaction: t });

      await queryInterface.addColumn('CreatorProfiles', 'rejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('CreatorProfiles', 'reviewedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });

      await queryInterface.addColumn('CreatorProfiles', 'reviewedAt', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('CreatorProfiles', 'clarificationRequested', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }, { transaction: t });

      await queryInterface.addColumn('CreatorProfiles', 'isDeleted', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }, { transaction: t });

      try {
        await queryInterface.removeConstraint('CreatorProfiles', 'CreatorProfiles_email_key', { transaction: t });
      } catch (err) {
        console.warn("Could not remove CreatorProfiles_email_key, it might not exist.");
      }
      try {
        await queryInterface.removeIndex('CreatorProfiles', 'idx_creator_email', { transaction: t });
      } catch (err) {
        console.warn("Could not remove idx_creator_email, it might not exist.");
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('CreatorProfiles', 'rejectionReason', { transaction: t });
      await queryInterface.removeColumn('CreatorProfiles', 'reviewedBy', { transaction: t });
      await queryInterface.removeColumn('CreatorProfiles', 'reviewedAt', { transaction: t });
      await queryInterface.removeColumn('CreatorProfiles', 'clarificationRequested', { transaction: t });
      await queryInterface.removeColumn('CreatorProfiles', 'isDeleted', { transaction: t });
    });
  }
};
