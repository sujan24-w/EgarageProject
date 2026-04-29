const express = require("express");
const router = express.Router();
const { getAllUsers, updateUser, deleteUser, getAllGarages, createGarage, updateGarage, deleteGarage, verifyGarage } = require("../controllers/admin.controller");
const { isAuthenticated, isAdmin } = require("../middlewares/auth.middleware");

// Users mapping
router.route("/users").get(isAuthenticated, isAdmin, getAllUsers);
router.route("/users/:id").put(isAuthenticated, isAdmin, updateUser).delete(isAuthenticated, isAdmin, deleteUser);

// Garages mapping
router.route("/garages").get(isAuthenticated, isAdmin, getAllGarages).post(isAuthenticated, isAdmin, createGarage);
router.route("/garages/:id").put(isAuthenticated, isAdmin, updateGarage).delete(isAuthenticated, isAdmin, deleteGarage);
router.route("/garages/:id/verify").put(isAuthenticated, isAdmin, verifyGarage);

module.exports = router;
