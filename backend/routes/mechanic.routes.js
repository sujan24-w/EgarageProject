const express = require("express");
const router = express.Router();
const { addMechanic, getMechanics, getMyMechanics, updateMechanic, deleteMechanic, mechanicLogin, mechanicRegister, getPendingMechanics, verifyMechanic, getMechanicProfile } = require("../controllers/mechanic.controller");
const { isAuthenticated, isGarageOwner, isAdmin } = require("../middlewares/auth.middleware");

router.route("/login").post(mechanicLogin);
router.route("/register").post(mechanicRegister);
router.route("/pending").get(isAuthenticated, isAdmin, getPendingMechanics);
router.route("/:id/verify").put(isAuthenticated, isAdmin, verifyMechanic);

router.route("/").post(isAuthenticated, isGarageOwner, addMechanic);
router.route("/my-mechanics").get(isAuthenticated, isGarageOwner, getMyMechanics);
router.route("/:id").put(isAuthenticated, isGarageOwner, updateMechanic).delete(isAuthenticated, isGarageOwner, deleteMechanic);
router.route("/profile/:id").get(getMechanicProfile);
router.route("/:garageId").get(getMechanics);

module.exports = router;
