const express = require("express");
const router = express.Router();
const { createOrUpdateGarage, getNearbyGarages, getGarageDetails, getMyGarage, searchGarages } = require("../controllers/garage.controller");
const { isAuthenticated, isGarageOwner } = require("../middlewares/auth.middleware");

// Specific routes before generic :id routes !
router.route("/nearby").get(getNearbyGarages);
router.route("/search").get(searchGarages);
router.route("/my").get(isAuthenticated, isGarageOwner, getMyGarage);

router.route("/").post(isAuthenticated, isGarageOwner, createOrUpdateGarage);
router.route("/:id").get(getGarageDetails);

module.exports = router;
