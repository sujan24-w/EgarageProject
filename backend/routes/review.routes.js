const express = require("express");
const router = express.Router();
const { createReview, getGarageReviews, getMyReviews, deleteReview } = require("../controllers/review.controller");
const { isAuthenticated, isAdmin, isGarageOwner } = require("../middlewares/auth.middleware");

// Creation by user
router.route("/").post(isAuthenticated, createReview);

// Fetching
router.route("/garage/:garageId").get(getGarageReviews);
router.route("/my-reviews").get(isAuthenticated, isGarageOwner, getMyReviews);

// Admin operations
router.route("/:id").delete(isAuthenticated, isAdmin, deleteReview);

module.exports = router;
