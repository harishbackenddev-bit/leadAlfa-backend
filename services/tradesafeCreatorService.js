const tradesafeService = require('./tradesafe.service');
const User = require('../models/user.model');

const registerCreatorWithTradeSafe = async (userId, profileData, bankDetails) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.tradeSafeUserId) {

      return {
        tradeSafeUserId: user.tradeSafeUserId,
        tradeSafeReference: user.tradeSafeReference,
        tradeSafeStatus: user.tradeSafeStatus,
        alreadyRegistered: true,
      };
    }

    const phoneNumber = profileData.phoneNumber || user.phone || '1231231231';

    const creatorData = {
      firstName: profileData.firstName || user.firstName || 'Creator',
      lastName: profileData.lastName || user.lastName || '',
      email: profileData.email || user.email,
      phoneNumber: phoneNumber,
      idNumber: profileData.saIdNumber || '',
      isSouthAfricanCitizen: profileData.isSouthAfricanCitizen === 'true' || 
                             profileData.isSouthAfricanCitizen === true,
    };

    console.log("Prepared creator data:", creatorData);

    const result = await tradesafeService.registerCreator(creatorData, {
      bankCode: bankDetails.bankCode,
      accountNumber: bankDetails.accountNumber,
      accountType: bankDetails.accountType || 'CHEQUE',
    });

    await user.update({
      tradeSafeUserId: result.id,
      tradeSafeReference: result.reference,
      tradeSafeStatus: 'PENDING',
      kycStatus: 'SUBMITTED',
      bankVerificationStatus: 'PENDING',
    });


    try {
      const orgs = await tradesafeService.getOrganizations();
      const organizationId = orgs?.[0]?.id;
      if (organizationId) {
        await tradesafeService.addUserToOrganization(result.id, organizationId, 'MEMBER');
      }
    } catch (orgError) {
      console.warn('Could not add user to organization:', orgError.message);
    }

    return {
      tradeSafeUserId: result.id,
      tradeSafeReference: result.reference,
      tradeSafeStatus: 'PENDING',
      alreadyRegistered: false,
    };

  } catch (error) {
    console.error("registerCreatorWithTradeSafe FAILED:", error.message);
    throw error;
  }
};

const getCreatorTradeSafeStatus = async (userId) => {

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
    if (user.tradeSafeUserId) {
      try {
        const token = await tradesafeService.getTokenStatus(user.tradeSafeUserId);
        if (token && token.id) {

          currentStatus = user.tradeSafeStatus;
        }
      } catch (error) {
        console.warn('Failed to fetch TradeSafe status:', error.message);
      }
    }

    return {
      registered: !!user.tradeSafeUserId,
      tradeSafeUserId: user.tradeSafeUserId,
      tradeSafeReference: user.tradeSafeReference,
      status: currentStatus,
      kycStatus: user.kycStatus,
      bankVerificationStatus: user.bankVerificationStatus,
    };
  } catch (error) {
    console.error("Error in getCreatorTradeSafeStatus:", error.message);
    throw error;
  }
};

module.exports = {
  registerCreatorWithTradeSafe,
  getCreatorTradeSafeStatus,
};