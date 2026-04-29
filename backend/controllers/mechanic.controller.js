const Mechanic = require("../models/mechanic.model");
const Garage = require("../models/garage.model");

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

    const { name, phone, image, status } = req.body;
    
    if (name) mechanic.name = name;
    if (phone) mechanic.phone = phone;
    if (image !== undefined) mechanic.image = image;
    if (status) mechanic.status = status;

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

module.exports = { addMechanic, getMechanics, getMyMechanics, updateMechanic, deleteMechanic };
