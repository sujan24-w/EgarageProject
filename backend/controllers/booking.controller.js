const Booking = require("../models/booking.model");
const Garage = require("../models/garage.model");

// @desc    Create a booking
// @route   POST /api/bookings
// @access  Private (User)
const createBooking = async (req, res) => {
  try {
    const { garageId, serviceId, type, issueLocation, issueImages, notes, appointmentDate, vehicleBrand, vehicleModel } = req.body;

    if (type === "standard") {
      if (!appointmentDate) return res.status(400).json({ message: "Appointment date is required for standard bookings." });
      
      const requestedDate = new Date(appointmentDate);
      if (requestedDate < new Date()) {
        return res.status(400).json({ message: "Cannot book an appointment in the past." });
      }

      const targetGarage = await Garage.findById(garageId);
      if (!targetGarage) return res.status(404).json({ message: "Garage not found." });

      // Validate closed days
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[requestedDate.getDay()];
      if (targetGarage.timing && targetGarage.timing.closedDays && targetGarage.timing.closedDays.includes(dayName)) {
        return res.status(400).json({ message: `Garage is closed on ${dayName}.` });
      }

      // Validate open/close times if not 24/7
      if (targetGarage.timing && !targetGarage.timing.is24_7) {
        const reqHour = requestedDate.getHours();
        const reqMin = requestedDate.getMinutes();
        const reqTimeStr = `${reqHour.toString().padStart(2, '0')}:${reqMin.toString().padStart(2, '0')}`;
        
        if (reqTimeStr < targetGarage.timing.openTime || reqTimeStr >= targetGarage.timing.closeTime) {
          return res.status(400).json({ message: "Requested time is outside garage working hours." });
        }
      }

      // Validate double booking (find any booking with exact same date/time)
      const existingBooking = await Booking.findOne({
        garageId,
        type: "standard",
        appointmentDate: requestedDate,
        status: { $nin: ["rejected", "cancelled"] }
      });

      if (existingBooking) {
        return res.status(400).json({ message: "This time slot is already booked." });
      }
    }

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

    // 2-minute timeout for PENDING bookings
    setTimeout(async () => {
      try {
        const checkBooking = await Booking.findById(booking._id);
        if (checkBooking && checkBooking.status === "pending") {
          checkBooking.status = "rejected";
          checkBooking.notes = (checkBooking.notes || "") + " [Auto-rejected: Garage did not respond within 2 minutes]";
          await checkBooking.save();
        }
      } catch(e) {
        console.error("Timeout auto-reject error:", e);
      }
    }, 2 * 60 * 1000);

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
    
    if (status === "completed" || status === "work-accepted") {
      if (costBreakdown) booking.costBreakdown = costBreakdown;
      if (totalAmount !== undefined) booking.totalAmount = totalAmount;
    }

    const updatedBooking = await booking.save();

    // Mechanics are no longer blindly marked "busy". 
    // Their availability is now calculated based on active assignments.
    // Standard bookings for future dates do not block immediate dispatches.

    if (status === "completed" || status === "rejected" || status === "cancelled") {
      // Logic for cleanup if needed, but we rely on active booking queries now.
    }

    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get mechanic bookings
// @route   GET /api/bookings/mechanic/:mechanicId
// @access  Public
const getMechanicBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ mechanicId: req.params.mechanicId })
      .populate("userId", "name phone")
      .populate("garageId", "name phone location")
      .sort("-createdAt");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update booking status by Mechanic
// @route   PUT /api/bookings/:id/mechanic
// @access  Public
const mechanicUpdateStatus = async (req, res) => {
  try {
    const { status, mechanicId, invoiceData, maintenanceReport } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Simple security: Must match the assigned mechanicId
    if (booking.mechanicId?.toString() !== mechanicId) {
      return res.status(403).json({ message: "Not authorized to update this booking" });
    }

    if (status) booking.status = status;
    if (req.body.paymentStatus) booking.paymentStatus = req.body.paymentStatus;
    if (maintenanceReport) booking.maintenanceReport = maintenanceReport;
    
    // If mechanic rejects assignment, revert status to accepted and clear mechanicId
    if (req.body.action === 'reject_assignment') {
      booking.status = 'accepted';
      booking.mechanicId = null;
    }
    
    // If mechanic completes the job, they can submit an initial bill
    if (status === "completed" && invoiceData) {
      booking.mechanicBill = {
        totalAmount: invoiceData.totalAmount || 0,
        details: invoiceData.details || ""
      };
    }

    const updatedBooking = await booking.save();
    
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booked standard slots for a specific date
// @route   GET /api/bookings/garage/:garageId/booked-slots?date=YYYY-MM-DD
// @access  Public
const getGarageBookedSlots = async (req, res) => {
  try {
    const { garageId } = req.params;
    const { date } = req.query;

    if (!date) return res.status(400).json({ message: "Date is required" });

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const bookings = await Booking.find({
      garageId,
      type: "standard",
      status: { $nin: ["rejected", "cancelled"] },
      appointmentDate: {
        $gte: startDate,
        $lt: endDate,
      },
    }).select("appointmentDate");

    const bookedSlots = bookings.map((b) => b.appointmentDate);
    res.json(bookedSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update booking status by User
// @route   PUT /api/bookings/:id/user
// @access  Private (User)
const userUpdateBooking = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Verify ownership
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this booking" });
    }

    if (status) {
      // Allow user to accept maintenance work after mechanic completion.
      if (status === 'work-accepted' && booking.status === 'maintenance-completed') {
        booking.paymentStatus = booking.paymentStatus || 'pending';
      }
      booking.status = status;
    }
    if (paymentStatus) booking.paymentStatus = paymentStatus;

    const updatedBooking = await booking.save();
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createBooking, getUserBookings, getGarageBookings, updateBookingStatus, getMechanicBookings, mechanicUpdateStatus, getGarageBookedSlots, userUpdateBooking };
