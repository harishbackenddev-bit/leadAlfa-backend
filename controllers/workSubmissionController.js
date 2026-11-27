const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const {
  createSubmission,
  resubmitAfterRevision,
  sendReminder,
  getJobSubmission,
} = require("../services/workSubmissionService");


const getJobSubmissionController = async (req, res) => {
  try {
    const { jobPublicId } = req.params;
    const creatorId = req.creatorId;

    const data = await getJobSubmission(jobPublicId, creatorId);

    if (!data) {
      return res.status(200).json({
        message: "No submission found for this job yet.",
        submission: null,
      });
    }

    return res.status(200).json({ submission: data });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error fetching job submission:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const createSubmissionController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobPublicId } = req.params;
    const creatorId = req.creatorId;
    const userId = req.user.id;
    const io = req.app.get("io");

    const result = await createSubmission(
      jobPublicId,
      creatorId,
      userId,
      req.body,
      io
    );

    return res.status(201).json({
      message: "Work submission created successfully.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error creating work submission:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const resubmitAfterRevisionController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobPublicId } = req.params;
    const creatorId = req.creatorId;
    const userId = req.user.id;
    const io = req.app.get("io");

    const result = await resubmitAfterRevision(
      jobPublicId,
      creatorId,
      userId,
      req.body,
      io
    );

    return res.status(201).json({
      message: "Revision resubmitted successfully.",
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error resubmitting work:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};


const sendReminderController = async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({
    field: path,
    message: msg,
  }));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobPublicId } = req.params;
    const creatorId = req.creatorId;
    const io = req.app.get("io");
    const message = req.body.message || null;

    const { nextReminderAvailableAt } = await sendReminder(
      jobPublicId,
      creatorId,
      message,
      io
    );

    return res.status(200).json({
      message: "Reminder sent to the brand successfully.",
      nextReminderAvailableAt,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Error sending reminder:", err.message);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

module.exports = {
  getJobSubmissionController,
  createSubmissionController,
  resubmitAfterRevisionController,
  sendReminderController,
};
