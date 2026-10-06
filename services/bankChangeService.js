const { BankChangeRequest, User } = require('../models');

// ============================================================
// 1. CREATE — Creator submits
// ============================================================
async function createBankChangeRequestService(req) {
  try {
    const userId = req.currentUser;
    const {
      reason,
      details,
      email,
      tradeSafeUserId,
      tradeSafeTokenId,
      tradeSafeReference,
    } = req.body;

    // ---------- Validation ----------
    if (!reason || !reason.trim()) {
      return { success: false, message: 'Reason is required', code: 400 };
    }
    if (!details || details.trim().length < 10) {
      return {
        success: false,
        message: 'Additional information must be at least 10 characters',
        code: 400,
      };
    }
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Valid email is required', code: 400 };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ---------- Check existing pending by email ----------
    const existing = await BankChangeRequest.findPendingByEmail(normalizedEmail);
    if (existing) {
      return {
        success: false,
        message: 'You already have a pending bank change request. Please wait for admin review.',
        code: 400,
        data: { existingRequestId: existing.id },
      };
    }

    // ---------- Optional user lookup by email ----------
    const user = await User.findOne({ where: { email: normalizedEmail } });

    // ---------- Create ----------
    const request = await BankChangeRequest.create({
      email: normalizedEmail,
      userId: user?.id || null,
      reason: reason.trim(),
      details: details.trim(),
      tradeSafeUserId: tradeSafeUserId || null,
      tradeSafeTokenId: tradeSafeTokenId || null,
      tradeSafeReference: tradeSafeReference || null,
      status: 'PENDING',
      avsStatus: 'PENDING',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Bank account change request submitted successfully',
      data: {
        requestId: request.id,
        status: request.status,
        avsStatus: request.avsStatus,
        submittedAt: request.createdAt,
      },
    };
  } catch (err) {
    console.error('Create bank change request error:', err);
    return {
      success: false,
      message: err.message || 'Failed to submit request',
      code: 500,
    };
  }
}

// ============================================================
// 2. GET MY REQUESTS — email के through
// ============================================================
async function getMyBankChangeRequestsService(req) {
  try {
    const userId = req.currentUser;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email'],
    });

    if (!user) {
      return { success: false, message: 'User not found', code: 404 };
    }

    const requests = await BankChangeRequest.getByEmail(
      user.email.toLowerCase()
    );

    return {
      success: true,
      message: 'Requests fetched successfully',
      data: requests,
    };
  } catch (err) {
    console.error('Get my requests error:', err);
    return { success: false, message: err.message, code: 500 };
  }
}

module.exports = {
  createBankChangeRequestService,
  getMyBankChangeRequestsService,
};