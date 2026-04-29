const express = require("express");
const router = express.Router();
const {
  createBooking,
  getUserBookings,
  getGarageBookings,
  updateBookingStatus,
} = require("../controllers/booking.controller");
const { isAuthenticated, isGarageOwner } = require("../middlewares/auth.middleware");

router.route("/").post(isAuthenticated, createBooking);
router.route("/mybookings").get(isAuthenticated, getUserBookings);
router.route("/garage").get(isAuthenticated, isGarageOwner, getGarageBookings);
router.route("/:id").put(isAuthenticated, isGarageOwner, updateBookingStatus);

module.exports = router;
