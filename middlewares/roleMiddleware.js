const { getUserRole } = require("../services/userService");

const allowRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userRole = await getUserRole(req.user.id);

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }

      req.user.role = userRole;

      next();
    } catch (error) {
      console.error("Role verification error:", error);
      res
        .status(error.statusCode || 500)
        .json({ message: error.message || "Internal Server Error" });
    }
  };
};

module.exports = { allowRoles };
