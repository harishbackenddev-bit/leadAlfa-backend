'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BankChangeRequests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      // ========== USER (email-based) ==========
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        // No FK constraint — loose reference
      },

      // ========== TRADESAFE IDs ==========
      tradeSafeUserId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tradeSafeTokenId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tradeSafeReference: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // ========== REQUEST DETAILS ==========
      reason: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // ========== STATUS ==========
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // ========== AVS ==========
      avsStatus: {
        type: Sequelize.ENUM('PENDING', 'VERIFIED', 'FAILED', 'SKIPPED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      avsVerifiedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // ========== AUDIT ==========
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // ========== TIMESTAMPS ==========
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // ========== INDEXES ==========
    await queryInterface.addIndex('BankChangeRequests', ['email'], {
      name: 'idx_bank_change_email',
    });
    await queryInterface.addIndex('BankChangeRequests', ['status'], {
      name: 'idx_bank_change_status',
    });
    await queryInterface.addIndex(
      'BankChangeRequests',
      ['email', 'status'],
      { name: 'idx_bank_change_email_status' }
    );
    await queryInterface.addIndex('BankChangeRequests', ['createdAt'], {
      name: 'idx_bank_change_createdAt',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('BankChangeRequests');

    // Drop enum types
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_BankChangeRequests_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_BankChangeRequests_avsStatus";'
    );
  },
};