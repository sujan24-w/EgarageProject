const Mechanic = require("../models/mechanic.model");
const Garage = require("../models/garage.model");
const Booking = require("../models/booking.model");
const Review = require("../models/review.model");

// @desc    Add a mechanic
// @route   POST /api/mechanics
// @access  Private (Garage Owner)
const addMechanic = async (req, res) => {
  try {
    const { name, phone, status, image } = req.body;
    const garage = await Garage.findOne({ ownerId: req.user._id });

    if (!garage) return res.status(404).json({ message: "Garage not found for this user" });

    const mechanic = await Mechanic.create({
      garageId: garage._id,
      name,
      phone,
      image: image || "",
      status: status || "available"
    });

    res.status(201).json(mechanic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all mechanics for a garage
// @route   GET /api/mechanics/:garageId
// @access  Public or Private
const getMechanics = async (req, res) => {
  try {
    const mechanics = await Mechanic.find({ garageId: req.params.garageId });
    res.json(mechanics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in garage owner's mechanics
// @route   GET /api/mechanics/my-mechanics
// @access  Private (Garage Owner)
const getMyMechanics = async (req, res) => {
  try {
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage) return res.status(404).json({ message: "Garage not found for this user" });
    const mechanics = await Mechanic.find({ garageId: garage._id });
    res.json(mechanics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a mechanic
// @route   PUT /api/mechanics/:id
// @access  Private (Garage Owner)
const updateMechanic = async (req, res) => {
  try {
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage) return res.status(404).json({ message: "Garage not found for this user" });

    const mechanic = await Mechanic.findOne({ _id: req.params.id, garageId: garage._id });
    if (!mechanic) return res.status(404).json({ message: "Mechanic not found or unauthorized" });

    const { name, phone, image, status, isVerified } = req.body;
    
    if (name) mechanic.name = name;
    if (phone) mechanic.phone = phone;
    if (image !== undefined) mechanic.image = image;
    if (status) mechanic.status = status;
    if (isVerified !== undefined) mechanic.isVerified = isVerified;

    const updatedMechanic = await mechanic.save();
    res.json(updatedMechanic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a mechanic
// @route   DELETE /api/mechanics/:id
// @access  Private (Garage Owner)
const deleteMechanic = async (req, res) => {
  try {
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage) return res.status(404).json({ message: "Garage not found for this user" });

    const mechanic = await Mechanic.findOneAndDelete({ _id: req.params.id, garageId: garage._id });
    if (!mechanic) return res.status(404).json({ message: "Mechanic not found or unauthorized to delete" });

    res.json({ message: "Mechanic actively removed from fleet" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mechanic Login (Phone only)
// @route   POST /api/mechanics/login
// @access  Public
const mechanicLogin = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    const mechanic = await Mechanic.findOne({ phone });
    if (!mechanic) return res.status(404).json({ message: "No mechanic found with this phone number" });

    if (!mechanic.isVerified) {
      return res.status(403).json({ message: "Account pending garage owner approval" });
    }

    res.json({ mechanicId: mechanic._id, name: mechanic.name, garageId: mechanic.garageId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mechanic Registration
// @route   POST /api/mechanics/register
// @access  Public
const mechanicRegister = async (req, res) => {
  try {
    const { name, phone, garageId, image, certificate } = req.body;
    if (!name || !phone || !garageId || !certificate) {
      return res.status(400).json({ message: "Name, phone, garage, and certificate are required" });
    }

    const garage = await Garage.findById(garageId);
    if (!garage) return res.status(404).json({ message: "Selected garage not found" });

    const existingMechanic = await Mechanic.findOne({ phone });
    if (existingMechanic) return res.status(400).json({ message: "Mechanic with this phone already exists" });

    const mechanic = await Mechanic.create({
      garageId,
      name,
      phone,
      image: image || "",
      certificate,
      isVerified: false,
      status: "offline" // Start offline until verified
    });

    res.status(201).json({ mechanicId: mechanic._id, message: "Registration successful. Pending garage owner approval." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending mechanics for admin
// @route   GET /api/mechanics/pending
// @access  Private (Admin)
const getPendingMechanics = async (req, res) => {
  try {
    const pendingMechanics = await Mechanic.find({ isVerified: false }).populate("garageId", "name phone");
    res.json(pendingMechanics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify a mechanic
// @route   PUT /api/mechanics/:id/verify
// @access  Private (Admin)
const verifyMechanic = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.params.id);
    if (!mechanic) return res.status(404).json({ message: "Mechanic not found" });

    mechanic.isVerified = true;
    mechanic.status = "available"; // Set to available once verified
    await mechanic.save();

    res.json({ message: "Mechanic verified successfully", mechanic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get mechanic profile with reviews and stats
// @route   GET /api/mechanics/profile/:id
// @access  Public
const getMechanicProfile = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.params.id).populate("garageId", "name phone location images");
    if (!mechanic) return res.status(404).json({ message: "Mechanic not found" });

    // Find all completed bookings assigned to this mechanic
    const bookings = await Booking.find({ mechanicId: req.params.id, status: "completed" }).select("_id");
    const bookingIds = bookings.map(b => b._id);

    // Find reviews associated with these bookings
    const reviews = await Review.find({ bookingId: { $in: bookingIds } })
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    // Calculate specific stats
    const avgRating = reviews.length ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : 0;

    res.json({
      mechanic,
      reviews,
      stats: {
        totalJobs: bookingIds.length,
        avgRating: parseFloat(avgRating)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addMechanic, getMechanics, getMyMechanics, updateMechanic, deleteMechanic, mechanicLogin, mechanicRegister, getPendingMechanics, verifyMechanic, getMechanicProfile };
