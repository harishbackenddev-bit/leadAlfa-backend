const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const invitationService = require("../services/campaignInvitationService");

/**
 * Handle bulk sending of invitations by brand
 */
const sendInvitationsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const brandId = req.brandId;
    const campaignId = parseInt(req.params.campaignId, 10);
    const { creatorIds, customMessage } = req.body;

    const invitations = await invitationService.sendInvitations(
      brandId,
      campaignId,
      creatorIds,
      customMessage
    );

    return res.status(201).json({
      message: "Invitations sent successfully.",
      invitations,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error sending invitations:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle listing of brand sent invitations
 */
const getBrandInvitationsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const brandId = req.brandId;
    const { campaignId, status, page = 1, limit = 10 } = req.query;

    const result = await invitationService.getBrandInvitations(brandId, {
      campaignId: campaignId ? parseInt(campaignId, 10) : undefined,
      status,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching brand invitations:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle brand withdrawing a pending invitation
 */
const withdrawInvitationController = async (req, res) => {
  try {
    const brandId = req.brandId;
    const { publicId } = req.params;

    const result = await invitationService.withdrawInvitation(brandId, publicId);

    return res.status(200).json({
      message: "Invitation withdrawn successfully.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error withdrawing invitation:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle listing of creator received invitations
 */
const getCreatorInvitationsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const creatorId = req.creatorId;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await invitationService.getCreatorInvitations(creatorId, {
      status,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching creator invitations:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle getting single invitation details for creator
 */
const getInvitationDetailsController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const { publicId } = req.params;

    const result = await invitationService.getInvitationDetails(creatorId, publicId);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching invitation details:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle creator accepting an invitation
 */
const acceptInvitationController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const { publicId } = req.params;

    const result = await invitationService.acceptInvitation(creatorId, publicId);

    return res.status(200).json({
      message: "Invitation accepted. You can now apply to the campaign.",
      invitation: result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error accepting invitation:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Handle creator declining an invitation
 */
const declineInvitationController = async (req, res) => {
  try {
    const creatorId = req.creatorId;
    const { publicId } = req.params;

    const result = await invitationService.declineInvitation(creatorId, publicId);

    return res.status(200).json({
      message: "Invitation declined successfully.",
      invitation: result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error declining invitation:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  sendInvitationsController,
  getBrandInvitationsController,
  withdrawInvitationController,
  getCreatorInvitationsController,
  getInvitationDetailsController,
  acceptInvitationController,
  declineInvitationController,
};
