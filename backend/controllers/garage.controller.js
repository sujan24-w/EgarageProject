const Garage = require("../models/garage.model");

// @desc    Create or update garage profile
// @route   POST /api/garages
// @access  Private (Garage Owner)
const createOrUpdateGarage = async (req, res) => {
  try {
    const { name, phone, coordinates, address, documents, images, isOpen, timing } = req.body;
    // coordinates should be [longitude, latitude]

    let garage = await Garage.findOne({ ownerId: req.user._id });

    const locationData = {
      type: "Point",
      coordinates: coordinates || [0, 0],
      address: address || ""
    };

    if (garage) {
      // Detect Critical Changes
      let criticalChange = false;
      
      if (coordinates && (garage.location.coordinates[0] !== coordinates[0] || garage.location.coordinates[1] !== coordinates[1] || garage.location.address !== address)) {
        criticalChange = true;
      }
      if (documents && documents.length > 0 && garage.documents[0] !== documents[0]) {
        criticalChange = true;
      }

      if (criticalChange) {
        garage.isVerified = false;
      }

      // Apply Updates
      garage.name = name || garage.name;
      garage.phone = phone || garage.phone;
      if (coordinates || address) garage.location = locationData;
      if (documents && documents.length > 0) garage.documents = documents;
      if (images) garage.images = images;
      if (isOpen !== undefined) garage.isOpen = isOpen;
      if (timing) garage.timing = timing;

      const updatedGarage = await garage.save();
      return res.json(updatedGarage);
    }

    // Create
    garage = await Garage.create({
      ownerId: req.user._id,
      name,
      phone,
      location: locationData,
      documents: documents || [],
      images: images || [],
      isOpen: isOpen !== undefined ? isOpen : true,
      timing: timing || { is24_7: true, openTime: "09:00", closeTime: "18:00", closedDays: [] }
    });

    res.status(201).json(garage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get nearby garages
// @route   GET /api/garages/nearby
// @access  Public
const getNearbyGarages = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 10000 } = req.query; // maxDistance in meters
    
    if (!lng || !lat) {
      return res.status(400).json({ message: "Please provide lng and lat" });
    }

    const garages = await Garage.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
    });

    res.json(garages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search garages by name or explore all
// @route   GET /api/garages/search
// @access  Public
const searchGarages = async (req, res) => {
  try {
    const { name, sortByRating } = req.query;
    
    let query = {};
    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    let dbQuery = Garage.find(query);
    
    if (sortByRating === 'asc') {
      dbQuery = dbQuery.sort({ rating: 1 });
    } else if (sortByRating === 'desc') {
      dbQuery = dbQuery.sort({ rating: -1 });
    } else {
      dbQuery = dbQuery.sort({ rating: -1 }); // default sort by best rating
    }

    const garages = await dbQuery;
    res.json(garages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get garage details
// @route   GET /api/garages/:id
// @access  Public
const getGarageDetails = async (req, res) => {
  try {
    const garage = await Garage.findById(req.params.id)
      .populate("ownerId", "name email phone")

    if (!garage) return res.status(404).json({ message: "Garage not found" });

    const Mechanic = require("../models/mechanic.model");
    const mechanics = await Mechanic.find({ garageId: garage._id });

    res.json({ ...garage.toObject(), mechanics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user's garage profile
// @route   GET /api/garages/my
// @access  Private (Garage)
const getMyGarage = async (req, res) => {
  try {
    const garage = await Garage.findOne({ ownerId: req.user._id })
      .populate("ownerId", "name email phone isActive");
    if (!garage) return res.status(404).json({ message: "Garage not found" });

    const Mechanic = require("../models/mechanic.model");
    const mechanics = await Mechanic.find({ garageId: garage._id });
    const available = mechanics.filter(m => m.status === 'available').length;
    
    const result = { 
      ...garage.toObject(), 
      stats: { totalMechanics: mechanics.length, availableMechanics: available } 
    };

    res.json(result);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = { createOrUpdateGarage, getNearbyGarages, getGarageDetails, getMyGarage, searchGarages };
