// services/tradesafeBrandService.js
const tradesafeService = require('./tradesafe.service');
const User = require('../models/user.model');

const mapBusinessTypeToOrgType = (businessType) => {
  const typeMap = {
    'single_brand': 'PRIVATE',
    'multi_brand_company': 'PRIVATE',
    'agency': 'PRIVATE',
    'company': 'PRIVATE',
    'private': 'PRIVATE',
    'public_company': 'PUBLIC',
    'public': 'PUBLIC',
    'freelancer': 'SOLE_PROP',
    'sole_proprietor': 'SOLE_PROP',
    'partnership': 'OTHER',
    'trust': 'TRUST',
    'non_profit': 'NPC',
    'npo': 'NPC',
    'close_corporation': 'CC',
    'cc': 'CC',
    'inc': 'INC',
    'state': 'STATE',
    'state_owned': 'STATE',
  };

  const mapped = typeMap[businessType?.toLowerCase()];
  if (!mapped) {
    console.warn(`⚠️ Unknown business type: "${businessType}", defaulting to "PRIVATE"`);
    return 'PRIVATE';
  }
  return mapped;
};

const registerBrandWithTradeSafe = async (userId, brandData, bankDetails) => {
  console.log("🏢 registerBrandWithTradeSafe STARTED");
  console.log("   User ID:", userId);

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.tradeSafeUserId) {
      console.log("ℹ️ Brand already registered with TradeSafe");
      return {
        tradeSafeUserId: user.tradeSafeUserId,
        tradeSafeReference: user.tradeSafeReference,
        tradeSafeStatus: user.tradeSafeStatus,
        alreadyRegistered: true,
      };
    }

    const organizationType = mapBusinessTypeToOrgType(brandData.organizationType);

    const brandDataForTradeSafe = {
      firstName: brandData.firstName || 'Brand',
      lastName: brandData.lastName || '',
      email: brandData.email,
      phoneNumber: brandData.phoneNumber || '1231231231',
      organizationName: brandData.organizationName || 'My Company',
      organizationType: organizationType,
      registrationNumber: brandData.registrationNumber || '',
      taxNumber: brandData.taxNumber || '',
      bankAccount: {
        bank: bankDetails.bankCode,
        accountNumber: bankDetails.accountNumber,
        accountType: bankDetails.accountType || 'CHEQUE',
      },
    };

    console.log("📤 Prepared brand data:", brandDataForTradeSafe);

    const result = await tradesafeService.registerBrand(brandDataForTradeSafe);

    console.log("✅ TradeSafe API call successful!");
    console.log("   TradeSafe ID:", result.id);
    console.log("   TradeSafe Reference:", result.reference);

    await user.update({
      tradeSafeUserId: result.id,
      tradeSafeReference: result.reference,
      tradeSafeStatus: 'PENDING',
      kycStatus: 'SUBMITTED',
    });

    // Add user to organization
    try {
      const orgs = await tradesafeService.getOrganizations();
      const organizationId = orgs?.[0]?.id;
      if (organizationId) {
        await tradesafeService.addUserToOrganization(result.id, organizationId, 'MEMBER');
        console.log(`✅ Brand ${result.id} added to organization`);
      }
    } catch (orgError) {
      console.warn('⚠️ Could not add brand to organization:', orgError.message);
    }

    return {
      tradeSafeUserId: result.id,
      tradeSafeReference: result.reference,
      tradeSafeStatus: 'PENDING',
      alreadyRegistered: false,
    };

  } catch (error) {
    console.error("❌ registerBrandWithTradeSafe FAILED:", error.message);
    throw error;
  }
};

const getBrandTradeSafeStatus = async (userId) => {
  console.log("📊 getBrandTradeSafeStatus STARTED");
  console.log("   User ID:", userId);

  try {
    const user = await User.findByPk(userId, {
      attributes: [
        'tradeSafeUserId',
        'tradeSafeReference',
        'tradeSafeStatus',
        'kycStatus',
        'bankVerificationStatus',
      ],
    });

    if (!user) {
      throw new Error('User not found');
    }

    let currentStatus = user.tradeSafeStatus;
    let currentKycStatus = user.kycStatus;
    let currentBankVerificationStatus = user.bankVerificationStatus;

    if (user.tradeSafeUserId) {
      try {
        const token = await tradesafeService.getTokenStatus(
          user.tradeSafeUserId
        );
console.log("tokenreponse",token);
        if (token && token.id) {
          console.log("✅ TradeSafe API status completed successfully");

          // Update statuses
          currentStatus = 'verified';
          currentKycStatus = 'verified';
          currentBankVerificationStatus = 'verified';

          await User.update(
            {
              tradeSafeStatus: currentStatus,
              kycStatus: currentKycStatus,
              bankVerificationStatus: currentBankVerificationStatus,
            },
            {
              where: {
                id: userId,
              },
            }
          );

          console.log("✅ TradeSafe statuses updated in DB");
          console.log("   tradeSafeStatus:", currentStatus);
          console.log("   kycStatus:", currentKycStatus);
          console.log(
            "   bankVerificationStatus:",
            currentBankVerificationStatus
          );
        }
      } catch (error) {
        console.warn(
          '⚠️ Failed to fetch TradeSafe status:',
          error.message
        );
      }
    }

    return {
      registered: !!user.tradeSafeUserId,
      tradeSafeUserId: user.tradeSafeUserId,
      tradeSafeReference: user.tradeSafeReference,
      status: currentStatus,
      kycStatus: currentKycStatus,
      bankVerificationStatus: currentBankVerificationStatus,
    };

  } catch (error) {
    console.error(
      "❌ Error in getBrandTradeSafeStatus:",
      error.message
    );

    throw error;
  }
};

module.exports = {
  registerBrandWithTradeSafe,
  getBrandTradeSafeStatus,
  mapBusinessTypeToOrgType,
};