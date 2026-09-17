'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.createTable('CampaignApplications', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Campaigns', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'CreatorProfiles', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      applicationStatus: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
      },
      proposedBudget: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      pitch: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('CampaignApplications', ['campaignId', 'creatorId'], {
      unique: true,
      name: 'unique_campaign_creator_application',
    });
    await queryInterface.addIndex('CampaignApplications', ['campaignId']);
    await queryInterface.addIndex('CampaignApplications', ['creatorId']);
    await queryInterface.addIndex('CampaignApplications', ['applicationStatus']);
  },

  async down (queryInterface, Sequelize) {
   await queryInterface.dropTable('CampaignApplications');
   await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CampaignApplications_applicationStatus";');
  }
};
