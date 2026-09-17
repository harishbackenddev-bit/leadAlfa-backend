const express = require("express");
const { body } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const router = express.Router();

const {
  createSkill,
  getAllSkills,
  getSkillById,
  updateSkill,
  deleteSkill,
} = require("../controllers/skillController");

router.get("/", getAllSkills);
router.get("/:id", getSkillById);

router.post(
  "/",
  authenticateJWT,
  allowRoles("admin"),
  [
    body("name").notEmpty().withMessage("Skill name required"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
  ],
  createSkill
);
router.put(
  "/:id",
  authenticateJWT,
  allowRoles("admin"),
  [
    body("name").optional().notEmpty().withMessage("Skill name required"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
  ],
  updateSkill
);
router.delete("/:id", authenticateJWT, allowRoles("admin"), deleteSkill);

module.exports = router;
