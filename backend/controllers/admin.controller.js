const Garage = require("../models/garage.model");
const User = require("../models/user.model");

// --- USER CRUD ---
// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) { res.status(500).json({ message: error.message }); }
}; 

// @desc    Update user
// @route   PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password");
    if(!user) return res.status(404).json({message: "User not found"}); 
    res.json(user);
  } catch (error) { res.status(500).json({ message: error.message }); } 
};
 
// @desc    Delete user
// @route   DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id); 
    res.json({ message: "User deleted" }); 
  } catch (error) { res.status(500).json({ message: error.message }); }
};


// --- GARAGE CRUD --- 
const Mechanic = require("../models/mechanic.model");

// @desc    Get all garages
// @route   GET /api/admin/garages
const getAllGarages = async (req, res) => {
  try {
    const garages = await Garage.find({}).populate("ownerId", "name email phone isActive").sort({ createdAt: -1 });
    
    // Inject mechanic stats into payload 
    const formattedGarages = await Promise.all(garages.map(async (g) => {
      const mechanics = await Mechanic.find({ garageId: g._id });
      const available = mechanics.filter(m => m.status === 'available').length;
      return { 
        ...g.toObject(), 
        stats: { totalMechanics: mechanics.length, availableMechanics: available } 
      };
    }));

    res.json(formattedGarages);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Create garage (Admin)
// @route   POST /api/admin/garages
const createGarage = async (req, res) => {
  try {
    // Requires an ownerId provided in req.body
    const garage = await Garage.create(req.body);
    res.status(201).json(garage);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Update garage
// @route   PUT /api/admin/garages/:id
const updateGarage = async (req, res) => {
  try {
    const garage = await Garage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if(!garage) return res.status(404).json({message: "Garage not found"});
    res.json(garage);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Delete garage
// @route   DELETE /api/admin/garages/:id
const deleteGarage = async (req, res) => {
  try {
    await Garage.findByIdAndDelete(req.params.id);
    res.json({ message: "Garage deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Toggle Garage Verification
// @route   PUT /api/admin/garages/:id/verify
const verifyGarage = async (req, res) => {
  try {
    const garage = await Garage.findById(req.params.id);
    if (!garage) return res.status(404).json({ message: "Garage not found" });

    garage.isVerified = !garage.isVerified; // Toggle state
    await garage.save();
    
    res.json({ message: "Garage verification toggled", garage });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = { getAllUsers, updateUser, deleteUser, getAllGarages, createGarage, updateGarage, deleteGarage, verifyGarage };
