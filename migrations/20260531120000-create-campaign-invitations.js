"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CampaignInvitations", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      publicId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Campaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "CreatorProfiles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      customMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM("pending", "accepted", "declined"),
        allowNull: false,
        defaultValue: "pending",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("CampaignInvitations", ["publicId"], {
      unique: true,
      name: "idx_campaignInvitation_publicId",
    });

    await queryInterface.addIndex(
      "CampaignInvitations",
      ["campaignId", "creatorId"],
      {
        unique: true,
        name: "unique_campaign_creator_invitation",
      }
    );

    await queryInterface.addIndex("CampaignInvitations", ["creatorId"], {
      name: "idx_campaignInvitation_creatorId",
    });

    await queryInterface.addIndex("CampaignInvitations", ["campaignId"], {
      name: "idx_campaignInvitation_campaignId",
    });

    await queryInterface.addIndex("CampaignInvitations", ["status"], {
      name: "idx_campaignInvitation_status",
    });

    // Alter CampaignApplications to add invitationId column
    await queryInterface.addColumn("CampaignApplications", "invitationId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "CampaignInvitations", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("CampaignApplications", ["invitationId"], {
      name: "idx_campaignApplication_invitationId",
    });
  },

  async down(queryInterface, Sequelize) {
   
    await queryInterface.removeColumn("CampaignApplications", "invitationId");
    
    await queryInterface.dropTable("CampaignInvitations");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CampaignInvitations_status";'
    );
  },
};
