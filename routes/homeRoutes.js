const express = require("express");
const router = express.Router();
const { getHomepageCreatorVideosController } = require("../controllers/homeController");


router.get("/creator-videos", getHomepageCreatorVideosController);

module.exports = router;
