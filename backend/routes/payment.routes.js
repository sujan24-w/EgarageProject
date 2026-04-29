const express = require("express");
const router = express.Router();
const {
  initiateEsewaPayment,
  verifyEsewaPayment,
  getUserReceipts,
  getReceiptById
} = require("../controllers/payment.controller");
const { isAuthenticated } = require("../middlewares/auth.middleware");

router.post("/esewa/initiate", isAuthenticated, initiateEsewaPayment);
router.post("/esewa/verify", isAuthenticated, verifyEsewaPayment);
router.get("/receipts", isAuthenticated, getUserReceipts);
router.get("/receipts/:id", isAuthenticated, getReceiptById);

module.exports = router;
