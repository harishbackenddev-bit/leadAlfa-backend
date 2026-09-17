"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CreatorCategories", {
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
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Categories",
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

    await queryInterface.addIndex("CreatorCategories", ["creatorId"], {
      name: "idx_creatorCategory_creatorId",
    });
    await queryInterface.addIndex("CreatorCategories", ["categoryId"], {
      name: "idx_creatorCategory_categoryId",
    });
    await queryInterface.addConstraint("CreatorCategories", {
      fields: ["creatorId", "categoryId"],
      type: "unique",
      name: "unique_creator_category_pair",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CreatorCategories");
  },
};
