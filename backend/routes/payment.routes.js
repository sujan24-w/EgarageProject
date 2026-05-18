const express = require("express");
const router = express.Router();
const {
  initiateEsewaPayment,
  verifyEsewaPayment,
  getUserReceipts,
  getGarageReceipts,
  getReceiptById,
  requestCashPayment,
  confirmCashPayment
} = require("../controllers/payment.controller");
const { isAuthenticated } = require("../middlewares/auth.middleware");

router.post("/esewa/initiate", isAuthenticated, initiateEsewaPayment);
router.post("/cash/request", isAuthenticated, requestCashPayment);
router.post("/cash/confirm", isAuthenticated, confirmCashPayment);
router.post("/esewa/verify", isAuthenticated, verifyEsewaPayment);
router.get("/receipts", isAuthenticated, getUserReceipts);
router.get("/garage/receipts", isAuthenticated, getGarageReceipts);
router.get("/receipts/:id", isAuthenticated, getReceiptById);

module.exports = router;
