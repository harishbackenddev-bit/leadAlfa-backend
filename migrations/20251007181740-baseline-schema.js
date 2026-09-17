'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     // USERS TABLE
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM('brand', 'creator', 'admin'),
        allowNull: true,
        defaultValue: null,
      },
      emailVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      verificationCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      verificationCodeExpires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resetPasswordToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      resetPasswordExpires: {
        type: Sequelize.DATE,
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

     // ASSETS TABLE
    await queryInterface.createTable('Assets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('image', 'video', 'gif', 'other'),
        allowNull: false,
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      public_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
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
  },

  async down (queryInterface, Sequelize) {
    // Reverse order of creation
    await queryInterface.dropTable('Assets');
    await queryInterface.dropTable('Users');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Assets_type";');
  }
};
