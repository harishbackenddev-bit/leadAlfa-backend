// migrations/20260904054723-add-new-fee-fields-to-transactions.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // =========================================================
    // Helper function to check if column exists
    // =========================================================
    const columnExists = async (tableName, columnName) => {
      const result = await queryInterface.sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = '${tableName}' 
         AND column_name = '${columnName}'`
      );
      return result[0].length > 0;
    };

    // =========================================================
    // 1. Add new financial fields (skip if exists)
    // =========================================================
    if (!(await columnExists('Transactions', 'brandServiceFeeAmount'))) {
      await queryInterface.addColumn('Transactions', 'brandServiceFeeAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (!(await columnExists('Transactions', 'brandServiceFeeCents'))) {
      await queryInterface.addColumn('Transactions', 'brandServiceFeeCents', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (!(await columnExists('Transactions', 'creatrendCombinedAmount'))) {
      await queryInterface.addColumn('Transactions', 'creatrendCombinedAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (!(await columnExists('Transactions', 'creatrendCombinedCents'))) {
      await queryInterface.addColumn('Transactions', 'creatrendCombinedCents', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (!(await columnExists('Transactions', 'brandContributionAmount'))) {
      await queryInterface.addColumn('Transactions', 'brandContributionAmount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }

    if (!(await columnExists('Transactions', 'brandContributionCents'))) {
      await queryInterface.addColumn('Transactions', 'brandContributionCents', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }

    // =========================================================
    // 2. Add funding tracking fields (skip if exists)
    // =========================================================
    if (!(await columnExists('Transactions', 'tradesafeFundingStatus'))) {
      await queryInterface.addColumn('Transactions', 'tradesafeFundingStatus', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!(await columnExists('Transactions', 'tradesafeReleaseStatus'))) {
      await queryInterface.addColumn('Transactions', 'tradesafeReleaseStatus', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!(await columnExists('Transactions', 'fundedAt'))) {
      await queryInterface.addColumn('Transactions', 'fundedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists('Transactions', 'fundingError'))) {
      await queryInterface.addColumn('Transactions', 'fundingError', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists('Transactions', 'fundingAttemptedAt'))) {
      await queryInterface.addColumn('Transactions', 'fundingAttemptedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // =========================================================
    // 3. Add fundingBatchId (skip if exists)
    // =========================================================
    if (!(await columnExists('Transactions', 'fundingBatchId'))) {
      await queryInterface.addColumn('Transactions', 'fundingBatchId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'FundingBatches',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // =========================================================
    // 4. Add new ENUM values (skip if already exists)
    // =========================================================
    // Check if enum values already exist
    const enumCheck = await queryInterface.sequelize.query(
      `SELECT unnest(enum_range(NULL::"enum_Transactions_status")) as value`
    );
    const existingEnumValues = enumCheck[0].map(row => row.value);
    
    if (!existingEnumValues.includes('PAYOUT_TRIGGERED')) {
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_Transactions_status" ADD VALUE IF NOT EXISTS 'PAYOUT_TRIGGERED';
      `);
    }
    
    if (!existingEnumValues.includes('FUNDING_IN_PROGRESS')) {
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_Transactions_status" ADD VALUE IF NOT EXISTS 'FUNDING_IN_PROGRESS';
      `);
    }
    
    if (!existingEnumValues.includes('FUNDING_FAILED')) {
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_Transactions_status" ADD VALUE IF NOT EXISTS 'FUNDING_FAILED';
      `);
    }

    // =========================================================
    // 5. Add indexes (skip if exists)
    // =========================================================
    const indexCheck = await queryInterface.sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Transactions' AND indexname = 'transactions_funding_batch_id_idx'`
    );
    
    if (indexCheck[0].length === 0) {
      await queryInterface.addIndex('Transactions', ['fundingBatchId'], {
        name: 'transactions_funding_batch_id_idx',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // =========================================================
    // Remove only columns that exist
    // =========================================================
    const columnExists = async (tableName, columnName) => {
      const result = await queryInterface.sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = '${tableName}' 
         AND column_name = '${columnName}'`
      );
      return result[0].length > 0;
    };

    // Remove indexes
    const indexCheck = await queryInterface.sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Transactions' AND indexname = 'transactions_funding_batch_id_idx'`
    );
    if (indexCheck[0].length > 0) {
      await queryInterface.removeIndex('Transactions', 'transactions_funding_batch_id_idx');
    }

    // Remove columns
    if (await columnExists('Transactions', 'fundingAttemptedAt')) {
      await queryInterface.removeColumn('Transactions', 'fundingAttemptedAt');
    }
    if (await columnExists('Transactions', 'fundingError')) {
      await queryInterface.removeColumn('Transactions', 'fundingError');
    }
    if (await columnExists('Transactions', 'fundedAt')) {
      await queryInterface.removeColumn('Transactions', 'fundedAt');
    }
    if (await columnExists('Transactions', 'tradesafeReleaseStatus')) {
      await queryInterface.removeColumn('Transactions', 'tradesafeReleaseStatus');
    }
    if (await columnExists('Transactions', 'tradesafeFundingStatus')) {
      await queryInterface.removeColumn('Transactions', 'tradesafeFundingStatus');
    }
    if (await columnExists('Transactions', 'fundingBatchId')) {
      await queryInterface.removeColumn('Transactions', 'fundingBatchId');
    }
    if (await columnExists('Transactions', 'brandContributionCents')) {
      await queryInterface.removeColumn('Transactions', 'brandContributionCents');
    }
    if (await columnExists('Transactions', 'brandContributionAmount')) {
      await queryInterface.removeColumn('Transactions', 'brandContributionAmount');
    }
    if (await columnExists('Transactions', 'creatrendCombinedCents')) {
      await queryInterface.removeColumn('Transactions', 'creatrendCombinedCents');
    }
    if (await columnExists('Transactions', 'creatrendCombinedAmount')) {
      await queryInterface.removeColumn('Transactions', 'creatrendCombinedAmount');
    }
    if (await columnExists('Transactions', 'brandServiceFeeCents')) {
      await queryInterface.removeColumn('Transactions', 'brandServiceFeeCents');
    }
    if (await columnExists('Transactions', 'brandServiceFeeAmount')) {
      await queryInterface.removeColumn('Transactions', 'brandServiceFeeAmount');
    }
  }
};