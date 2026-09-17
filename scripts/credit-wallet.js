// scripts/credit-wallet.js
require('dotenv').config();
const tradesafeService = require('../services/tradesafe.service');

(async () => {
  try {
    console.log('💰 Crediting Naveen R1200...\n');

    const result = await tradesafeService.tokenUpdateBalance({
      id: '34L40pDZS32ngzhHEZTbZ',
      value: 1200,
      type: 'CREDIT',
    });

    console.log('\n✅ New balance:', result?.balance);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();