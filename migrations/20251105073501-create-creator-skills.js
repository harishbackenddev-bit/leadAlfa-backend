"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CreatorSkills", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CreatorProfiles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      skillId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Skills",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

    await queryInterface.addIndex("CreatorSkills", ["creatorId"], {
      name: "idx_creatorSkill_creatorId",
    });
    await queryInterface.addIndex("CreatorSkills", ["skillId"], {
      name: "idx_creatorSkill_skillId",
    });
    await queryInterface.addConstraint("CreatorSkills", {
      fields: ["creatorId", "skillId"],
      type: "unique",
      name: "unique_creator_skill_pair",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CreatorSkills");
  },
};
