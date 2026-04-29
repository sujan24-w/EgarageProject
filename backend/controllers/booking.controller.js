const Booking = require("../models/booking.model");
const Garage = require("../models/garage.model");

// @desc    Create a booking
// @route   POST /api/bookings
// @access  Private (User)
const createBooking = async (req, res) => {
  try {
    const { garageId, serviceId, type, issueLocation, issueImages, notes, appointmentDate, vehicleBrand, vehicleModel } = req.body;

    const booking = await Booking.create({
      userId: req.user._id,
      garageId,
      serviceId,
      type, // "immediate", "towing", or "standard"
      issueLocation: (type === "immediate" || type === "towing") ? issueLocation : undefined,
      vehicleBrand,
      vehicleModel,
      issueImages,
      notes,
      appointmentDate: type === "standard" ? appointmentDate : undefined,
    });

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings/mybookings
// @access  Private
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate("garageId", "name phone location")
      .populate("mechanicId", "name phone status");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get garage bookings
// @route   GET /api/bookings/garage
// @access  Private (Garage Owner)
const getGarageBookings = async (req, res) => {
  try {
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage) return res.status(404).json({ message: "Garage not found" });

    const bookings = await Booking.find({ garageId: garage._id })
      .populate("userId", "name phone")
      .populate("mechanicId", "name phone status");

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Mechanic = require("../models/mechanic.model");

// @desc    Update booking status (Accept/Reject/Complete) & Assign Mechanic
// @route   PUT /api/bookings/:id
// @access  Private (Garage Owner)
const updateBookingStatus = async (req, res) => {
  try {
    const { status, mechanicId, costBreakdown, totalAmount } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Verify ownership
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage || garage._id.toString() !== booking.garageId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this booking" });
    }

    if (status) booking.status = status;
    if (mechanicId) booking.mechanicId = mechanicId;
    
    if (status === "completed") {
      if (costBreakdown) booking.costBreakdown = costBreakdown;
      if (totalAmount !== undefined) booking.totalAmount = totalAmount;
    }

    const updatedBooking = await booking.save();

    // Auto-manage Mechanic availability
    if (status === "accepted" && mechanicId) {
      await Mechanic.findByIdAndUpdate(mechanicId, { status: "busy" });
    }
    if (status === "completed" || status === "rejected") {
      if (updatedBooking.mechanicId) {
        await Mechanic.findByIdAndUpdate(updatedBooking.mechanicId, { status: "available" });
      }
    }

    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createBooking, getUserBookings, getGarageBookings, updateBookingStatus };
