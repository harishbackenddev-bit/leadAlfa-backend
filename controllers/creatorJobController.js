const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const { getCreatorJobs } = require("../services/creatorJobService");

const getCreatorJobsController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => {
    return { field: path, message: msg };
  });
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const creatorId = req.creatorId;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await getCreatorJobs(creatorId, { status, page, limit });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching creator jobs:", err.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  getCreatorJobsController,
};
