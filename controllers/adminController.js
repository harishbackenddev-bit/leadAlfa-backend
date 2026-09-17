const adminService = require("../services/adminService");
const AppError = require("../utils/appError");

exports.getCreatorProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await adminService.getCreatorProfileById(id);
    res.status(200).json({ profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching creator profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to fetch profile" });
  }
};

exports.getCreatorProfileRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const result = await adminService.getCreatorProfileRequests(
      status,
      page,
      limit
    );

    res.status(200).json({
      totalItems: result.count,
      totalPages: Math.ceil(result.count / result.limit),
      currentPage: result.page,
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching creator profiles:", error);
    res.status(500).json({ error: "Failed to fetch profile requests" });
  }
};

exports.approveProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await adminService.approveProfile(id, req.user.id);
    res.status(200).json({ message: "Profile approved successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error approving profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to approve profile" });
  }
};

exports.rejectProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const profile = await adminService.rejectProfile(id, reason, req.user.id);
    res.status(200).json({ message: "Profile rejected successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error rejecting profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to reject profile" });
  }
};

exports.askClarification = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const profile = await adminService.askClarification(
      id,
      message,
      req.user.id
    );
    res
      .status(200)
      .json({ message: "Clarification requested successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error clarifying profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to request clarification" });
  }
};

exports.deleteProfileRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await adminService.deleteProfileRequest(id);
    res.status(200).json({ message: "Profile request deleted successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting profile request:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to delete profile request" });
  }
};

exports.getBrandProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await adminService.getBrandProfileById(id);
    res.status(200).json({ profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching brand profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to fetch profile" });
  }
};

exports.getBrandProfileRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const result = await adminService.getBrandProfileRequests(
      status,
      page,
      limit
    );

    res.status(200).json({
      totalItems: result.count,
      totalPages: Math.ceil(result.count / result.limit),
      currentPage: result.page,
      data: result.rows,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching brand profiles:", error);
    res.status(500).json({ error: "Failed to fetch profile requests" });
  }
};

exports.approveBrandProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await adminService.approveBrandProfile(id, req.user.id);
    res.status(200).json({ message: "Brand profile approved successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error approving brand profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to approve profile" });
  }
};

exports.rejectBrandProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const profile = await adminService.rejectBrandProfile(id, reason, req.user.id);
    res.status(200).json({ message: "Brand profile rejected successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error rejecting brand profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to reject profile" });
  }
};

exports.askBrandClarification = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const profile = await adminService.askBrandClarification(
      id,
      message,
      req.user.id
    );
    res
      .status(200)
      .json({ message: "Clarification requested successfully", profile });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error clarifying brand profile:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to request clarification" });
  }
};

exports.deleteBrandProfileRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await adminService.deleteBrandProfileRequest(id);
    res.status(200).json({ message: "Brand profile request deleted successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting brand profile request:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to delete profile request" });
  }
};
