const express = require("express");
const router = express.Router();
const { addMechanic, getMechanics, getMyMechanics, updateMechanic, deleteMechanic } = require("../controllers/mechanic.controller");
const { isAuthenticated, isGarageOwner } = require("../middlewares/auth.middleware");

router.route("/").post(isAuthenticated, isGarageOwner, addMechanic);
router.route("/my-mechanics").get(isAuthenticated, isGarageOwner, getMyMechanics);
router.route("/:id").put(isAuthenticated, isGarageOwner, updateMechanic).delete(isAuthenticated, isGarageOwner, deleteMechanic);
router.route("/:garageId").get(getMechanics);

module.exports = router;
