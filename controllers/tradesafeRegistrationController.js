// controllers/tradesafeRegistrationController.js
const { registerCreatorWithTradeSafe, getCreatorTradeSafeStatus } = require("../services/tradesafeCreatorService");
const { registerBrandWithTradeSafe, getBrandTradeSafeStatus } = require("../services/tradesafeBrandService");
const tradesafeService = require('../services/tradesafe.service');
const User = require("../models/user.model");

const registerCreator = async (req, res) => {
  console.log("🔄 registerCreator (Separate API) STARTED");

  try {
    const userId = req.user.id;
    const { bank, accountNumber, accountType } = req.body;

    console.log("👤 User ID:", userId);
    console.log("🏦 Bank Details:", { bank, accountNumber, accountType });

    if (!bank || !accountNumber) {
      return res.status(400).json({ error: "Bank name and account number are required" });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role !== "creator") {
      return res.status(403).json({ error: "Only creators can register for payouts" });
    }

    if (user.tradeSafeUserId) {
      return res.status(400).json({
        error: "Already registered with TradeSafe",
        tradeSafeUserId: user.tradeSafeUserId,
        tradeSafeReference: user.tradeSafeReference,
        status: user.tradeSafeStatus,
      });
    }

    const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
    const profile = await CreatorProfile.findOne({ where: { userId } });

    if (!profile) {
      return res.status(404).json({ error: "Creator profile not found" });
    }

    const creatorData = {
      firstName: profile.firstName || user.firstName,
      lastName: profile.lastName || user.lastName || "",
      email: profile.email || user.email,
      phoneNumber: profile.phoneNumber || user.phone || "",
      saIdNumber: profile.saIdNumber || "",
      isSouthAfricanCitizen: profile.isSouthAfricanCitizen,
    };

    const tradesafeResult = await registerCreatorWithTradeSafe(
      userId,
      creatorData,
      {
        bankCode: bank,
        accountNumber: accountNumber,
        accountType: accountType || "CHEQUE",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Creator registered with TradeSafe successfully",
      data: tradesafeResult,
    });

  } catch (error) {
    console.error("❌ Creator registration error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to register creator" });
  }
};

const registerBrand = async (req, res) => {
  console.log("🔄 registerBrand (Separate API) STARTED");

  try {
    const userId = req.user.id;
    const { bank, accountNumber, accountType } = req.body;

    console.log("👤 User ID:", userId);
    console.log("🏦 Bank Details:", { bank, accountNumber, accountType });

    if (!bank || !accountNumber) {
      return res.status(400).json({ error: "Bank name and account number are required" });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role !== "brand") {
      return res.status(403).json({ error: "Only brands can register for payouts" });
    }

    if (user.tradeSafeUserId) {
      return res.status(400).json({
        error: "Already registered with TradeSafe",
        tradeSafeUserId: user.tradeSafeUserId,
        tradeSafeReference: user.tradeSafeReference,
        status: user.tradeSafeStatus,
      });
    }

    const BrandProfile = require("../models/brandProfile/brandProfile.model");
    const profile = await BrandProfile.findOne({ where: { userId } });

    if (!profile) {
      return res.status(404).json({ error: "Brand profile not found" });
    }

    // Ensure we have all required fields
    const brandData = {
      firstName: user.firstName || profile.contactPersonFirstName || "Brand",
      lastName: user.lastName || profile.contactPersonLastName || "User",
      email: user.email || profile.companyEmail || "brand@example.com",
      phoneNumber: user.phone || profile.phoneNumber || "0821234567",
      organizationName: profile.companyName || "My Company",
      organizationType: profile.businessType || "PRIVATE",
      registrationNumber: profile.companyRegistrationNumber || "2000/123456/07",
      taxNumber: profile.taxNumber || "1234567890",
    };

    const tradesafeResult = await registerBrandWithTradeSafe(
      userId,
      brandData,
      {
        bankCode: bank,
        accountNumber: accountNumber,
        accountType: accountType || "CHEQUE",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Brand registered with TradeSafe successfully",
      data: tradesafeResult,
    });

  } catch (error) {
    console.error("❌ Brand registration error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to register brand" });
  }
};

const getTradeSafeStatus = async (req, res) => {
  console.log("📊 getTradeSafeStatus STARTED");

  try {
    const userId = req.user.id;
    console.log("📊 userId:", userId);

    const user = await User.findByPk(userId, {
      attributes: [
        "tradeSafeUserId",
        "tradeSafeReference",
        "tradeSafeStatus",
        "kycStatus",
        "bankVerificationStatus",
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // ✅ Use .get() — reliable
    const tradeSafeUserId = user.get("tradeSafeUserId");
    const tradeSafeReference = user.get("tradeSafeReference");

    let currentStatus = user.get("tradeSafeStatus");
    let currentKycStatus = user.get("kycStatus");
    let currentBankVerificationStatus = user.get("bankVerificationStatus");

    console.log("📊 Extracted:");
    console.log("   tradeSafeUserId:", tradeSafeUserId);
    console.log("   tradeSafeReference:", tradeSafeReference);
    console.log("   status:", currentStatus);

    // ============================================================
    // Check TradeSafe token
    // ============================================================
    if (tradeSafeUserId) {
      try {
        const token = await tradesafeService.getTokenStatus(tradeSafeUserId);

        console.log("📊 TradeSafe token response:", token);

        if (token && token.id) {
          console.log("✅ TradeSafe token exists");

          currentStatus = "VERIFIED";
          currentKycStatus = "VERIFIED";
          currentBankVerificationStatus = "VERIFIED";

          const [updatedRows] = await User.update(
            {
              tradeSafeStatus: currentStatus,
              kycStatus: currentKycStatus,
              bankVerificationStatus: currentBankVerificationStatus,
            },
            { where: { id: userId } }
          );

          console.log("✅ TradeSafe status DB updated");
          console.log("   Updated rows:", updatedRows);
        } else {
          console.log("⚠️ TradeSafe token not found");
        }
      } catch (error) {
        console.warn("⚠️ Failed to fetch TradeSafe status:", error.message);
      }
    }

    // ============================================================
    // Response — using extracted variables
    // ============================================================
    const responseData = {
      registered: Boolean(tradeSafeUserId),
      tradeSafeUserId: tradeSafeUserId || null,
      tradeSafeReference: tradeSafeReference || null,
      status: currentStatus || "UNREGISTERED",
      kycStatus: currentKycStatus || "PENDING",
      bankVerificationStatus: currentBankVerificationStatus || "PENDING",
    };

    console.log("📊 Final response data:", responseData);

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching TradeSafe status:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch TradeSafe status",
    });
  }
};

module.exports = {
  registerCreator,
  registerBrand,
  getTradeSafeStatus,
};