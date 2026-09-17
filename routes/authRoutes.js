const express = require("express");
const router = express.Router();
const { socialLogin } = require("../controllers/socialAuthController");
const { check } = require("express-validator");

router.post(
  "/social",
  [check("token", "Auth0 token is required").notEmpty()],
  socialLogin
);

module.exports = router;
