const express = require("express");
const {body} = require("express-validator");
const {authenticateJWT} = require("../middlewares/authMiddleware");
const {allowRoles} = require("../middlewares/roleMiddleware");
const router = express.Router();

const { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } = require("../controllers/categoryController");

router.get("/", getAllCategories);

router.get('/:id',getCategoryById);

router.post('/',authenticateJWT,allowRoles("admin"),
  [
    body("name").notEmpty().withMessage("Category name required"),
    body("description").optional().isString().withMessage("Description must be a string"),
  ] ,createCategory);

router.put('/:id',authenticateJWT,
  allowRoles("admin"),
  [
    body("name").optional().notEmpty().withMessage("Category name required"),
    body("description").optional().isString().withMessage("Description must be a string"),
  ] ,updateCategory);

router.delete('/:id',authenticateJWT,allowRoles("admin"),deleteCategory);

module.exports = router;