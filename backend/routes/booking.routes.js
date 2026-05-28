const express = require("express");
const router = express.Router();
const {
  createBooking,
  getUserBookings,
  getGarageBookings,
  updateBookingStatus,
  getMechanicBookings,
  mechanicUpdateStatus,
  getGarageBookedSlots,
  userUpdateBooking
} = require("../controllers/booking.controller");
const { isAuthenticated, isGarageOwner } = require("../middlewares/auth.middleware");

router.route("/").post(isAuthenticated, createBooking);
router.route("/mybookings").get(isAuthenticated, getUserBookings);
router.route("/garage").get(isAuthenticated, isGarageOwner, getGarageBookings);
router.route("/:id").put(isAuthenticated, isGarageOwner, updateBookingStatus);
router.route("/:id/user").put(isAuthenticated, userUpdateBooking);
router.route("/garage/:garageId/booked-slots").get(getGarageBookedSlots);
router.route("/mechanic/:mechanicId").get(getMechanicBookings);
router.route("/:id/mechanic").put(mechanicUpdateStatus);

module.exports = router;
