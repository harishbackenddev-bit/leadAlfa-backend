// migrations/XXXXXXXXXXXXXX-create-transactions-table.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ============================================
    // 1. CREATE TRANSACTIONS TABLE
    // ============================================
    await queryInterface.createTable('Transactions', {
      // ---------- Primary Key ----------
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      // ---------- Foreign Keys ----------
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Campaigns',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      brandUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      creatorUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      campaignCreatorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      // ---------- Financial (Cents) ----------
      amountCents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      platformFeeCents: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      creatorNetCents: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      commissionCents: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      // ---------- Financial (Rands) ----------
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      platformFee: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      creatorNetAmount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      commissionAmount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },

      // ---------- TradeSafe ----------
      tradesafeTransactionId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tradesafeAllocationId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      checkoutLink: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      reference: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // ---------- Status ----------
      status: {
        type: Sequelize.ENUM(
          'CREATED',
          'PENDING_PAYMENT',
          'FUNDED',
          'IN_PROGRESS',
          'DELIVERED',
          'UNDER_REVIEW',
          'REVISION_REQUESTED',
          'APPROVED',
          'RELEASED',
          'COMPLETED',
          'DISPUTED',
          'REFUNDED',
          'CANCELLED'
        ),
        defaultValue: 'CREATED',
        allowNull: false,
      },

      // ---------- Timestamps ----------
      lockedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      releasedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refundedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deliveryStartedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      approvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // ---------- Webhook Tracking ----------
      lastWebhookReceived: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastWebhookPayload: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      retryCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // ---------- Metadata ----------
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
      },

      // ---------- Audit ----------
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // ============================================
    // 2. ADD INDEXES
    // ============================================
    await queryInterface.addIndex('Transactions', ['campaignId'], {
      name: 'idx_transactions_campaignId',
    });

    await queryInterface.addIndex('Transactions', ['brandUserId'], {
      name: 'idx_transactions_brandUserId',
    });

    await queryInterface.addIndex('Transactions', ['creatorUserId'], {
      name: 'idx_transactions_creatorUserId',
    });

    await queryInterface.addIndex('Transactions', ['tradesafeTransactionId'], {
      name: 'idx_transactions_tradesafeTransactionId',
    });

    await queryInterface.addIndex('Transactions', ['status'], {
      name: 'idx_transactions_status',
    });

    await queryInterface.addIndex('Transactions', ['reference'], {
      name: 'idx_transactions_reference',
    });
  },

  // ============================================
  // 3. DOWN: ROLLBACK
  // ============================================
  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable('Transactions');

    // Drop ENUM type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Transactions_status";'
    );
  },
};