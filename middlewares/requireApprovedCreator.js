const requireApprovedCreator = (req, res, next) => {
  if (!req.creatorStatus) {
    return res.status(403).json({
      error: "Creator profile context is missing. Ensure you have properly authenticated.",
    });
  }

  if (req.creatorStatus !== "approved") {
    return res.status(403).json({
      error: `Action restricted. Your creator profile status is currently '${req.creatorStatus}'. Only approved creators can perform this action.`,
      status: req.creatorStatus,
    });
  }

  next();
};

module.exports = { requireApprovedCreator };
