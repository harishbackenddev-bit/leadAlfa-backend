const express = require('express');
const {authenticateJWT} = require('../middlewares/authMiddleware');
const {attachCreatorContext} = require('../middlewares/attachCreatorContextMiddleware');
const { requireApprovedCreator } = require("../middlewares/requireApprovedCreator");
const {connect, callback} = require('../controllers/socialAccountController');

const router = express.Router();

router.get("/social/:platform/connect",authenticateJWT,attachCreatorContext,requireApprovedCreator,connect);
router.get("/social/:platform/callback",callback);

module.exports = router;