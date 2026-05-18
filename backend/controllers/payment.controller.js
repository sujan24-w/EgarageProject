const crypto = require("crypto");
const Booking = require("../models/booking.model");
const Receipt = require("../models/receipt.model");

const ESEWA_MERCHANT_CODE = "EPAYTEST";
const ESEWA_SECRET = "8gBm/:&EnhH.1/q";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// @desc    Initiate eSewa Payment
// @route   POST /api/payments/esewa/initiate
// @access  Private
const initiateEsewaPayment = async (req, res) => {
  try {
    const { bookingId, isAdvance } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to pay for this booking" });
    }

    let amount = booking.totalAmount;
    let transactionType = "final";

    if (isAdvance) {
      if (booking.advanceAmountPaid > 0) return res.status(400).json({ message: "Advance payment already made." });
      amount = 500; // Rs. 500 Flat Advance Fee
      transactionType = "advance";
    } else {
      if (booking.paymentStatus === "paid") {
        return res.status(400).json({ message: "Booking is already paid natively." });
      }
      if (booking.status !== "completed") {
        return res.status(400).json({ message: "Booking is not completed yet" });
      }
      if (booking.advanceAmountPaid > 0) {
        amount = booking.totalAmount - booking.advanceAmountPaid; // Deduct advance
      }
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount to pay" });
    }

    const transactionUuid = `${booking._id}-${transactionType}-${Date.now()}`;
    const message = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const signature = crypto.createHmac("sha256", ESEWA_SECRET).update(message).digest("base64");

    const formData = {
      amount: amount,
      tax_amount: 0,
      total_amount: amount,
      transaction_uuid: transactionUuid,
      product_code: ESEWA_MERCHANT_CODE,
      product_service_charge: 0,
      product_delivery_charge: 0,
      success_url: `${FRONTEND_URL}/payment/success`,
      failure_url: `${FRONTEND_URL}/payment/failure`,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: signature
    };

    res.json({ formData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify eSewa Payment
// @route   POST /api/payments/esewa/verify
// @access  Private
const verifyEsewaPayment = async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: "No callback data provided" });

    const decodedStr = Buffer.from(data, "base64").toString("utf-8");
    const parsedData = JSON.parse(decodedStr);

    if (parsedData.status !== "COMPLETE") {
      return res.status(400).json({ message: "Payment was not completed inside gateway" });
    }

    const signedFields = parsedData.signed_field_names.split(",");
    const messageParts = signedFields.map(field => `${field}=${parsedData[field]}`);
    const message = messageParts.join(",");

    const generatedSignature = crypto.createHmac("sha256", ESEWA_SECRET).update(message).digest("base64");
    if (generatedSignature !== parsedData.signature) {
      return res.status(400).json({ message: "Verification failed. Invalid signature integrity." });
    }

    const uuidParts = parsedData.transaction_uuid.split("-");
    const bookingId = uuidParts[0];
    const transactionType = uuidParts[1];

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Secure Booking structure not found" });
    
    if (transactionType === "advance") {
      if (booking.advanceAmountPaid > 0) return res.json({ message: "Advance already verified" });
      booking.advanceAmountPaid = Number(parsedData.total_amount);
      await booking.save();
      
      const receipt = await Receipt.create({
        userId: booking.userId,
        garageId: booking.garageId,
        bookingId: booking._id,
        costBreakdown: [{ item: "Standard Booking Advance Fee", price: parsedData.total_amount }],
        totalAmount: parsedData.total_amount,
        paymentMethod: "eSewa",
        transactionId: parsedData.transaction_code
      });

      return res.json({ message: "Advance Payment verified & locked.", receiptId: receipt._id });
    } 
    else {
      if (booking.paymentStatus === "paid") {
        return res.json({ message: "Already verified natively", receiptCreated: false });
      }

      booking.paymentStatus = "paid";
      booking.transactionId = parsedData.transaction_code;
      await booking.save();

      const receipt = await Receipt.create({
        userId: booking.userId,
        garageId: booking.garageId,
        bookingId: booking._id,
        costBreakdown: booking.costBreakdown,
        totalAmount: parsedData.total_amount, // The remaining balance paid essentially
        paymentMethod: "eSewa",
        transactionId: parsedData.transaction_code
      });

      return res.json({ message: "Final Payment clear. Services concluded.", receiptId: receipt._id });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.find({ userId: req.user._id })
      .populate("garageId", "name phone location")
      .populate({
         path: "bookingId",
         select: "serviceId type appointmentDate",
         populate: { path: "serviceId", select: "name" }
      })
      .sort({ createdAt: -1 });

    res.json(receipts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGarageReceipts = async (req, res) => {
  try {
    // Assuming req.user is the Garage Owner.
    // The GarageId is tied to the owner. Let's find the garage first.
    const Garage = require("../models/garage.model");
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if (!garage) return res.status(404).json({ message: "Garage not found for this owner." });

    const receipts = await Receipt.find({ garageId: garage._id })
      .populate("userId", "name phone")
      .populate({
         path: "bookingId",
         select: "serviceId type appointmentDate vehicleBrand vehicleModel notes",
         populate: { path: "serviceId", select: "name" }
      })
      .sort({ createdAt: -1 });

    res.json(receipts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate("garageId", "name phone location email")
      .populate("userId", "name phone email")
      .populate({
        path: "bookingId",
        populate: [
          { path: "serviceId", select: "name description" },
          { path: "mechanicId", select: "name phone" }
        ]
      });

    if (!receipt) return res.status(404).json({ message: "Receipt not found" });
    if (receipt.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request Cash Payment (By User)
// @route   POST /api/payments/cash/request
// @access  Private
const requestCashPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to pay for this booking" });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Booking is already paid natively." });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Booking is not completed yet" });
    }

    booking.paymentStatus = "cash_requested";
    await booking.save();

    res.json({ message: "Site payment (pay later) requested. Awaiting Garage Owner confirmation." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Confirm Cash Payment (By Garage Owner)
// @route   POST /api/payments/cash/confirm
// @access  Private
const confirmCashPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    const Garage = require("../models/garage.model");
    const garage = await Garage.findOne({ ownerId: req.user._id });

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!garage || booking.garageId.toString() !== garage._id.toString()) {
      return res.status(403).json({ message: "Only the assigned Garage owner can confirm this payment." });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Booking is already paid natively." });
    }
    if (booking.paymentStatus !== "cash_requested") {
      return res.status(400).json({ message: "Cash payment has not been requested by the user." });
    }

    let amount = booking.totalAmount;
    if (booking.advanceAmountPaid > 0) {
      amount = booking.totalAmount - booking.advanceAmountPaid; // Deduct advance
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount to pay" });
    }

    booking.paymentStatus = "paid";
    booking.transactionId = `CASH-${Date.now()}`;
    await booking.save();

    const receipt = await Receipt.create({
      userId: booking.userId,
      garageId: booking.garageId,
      bookingId: booking._id,
      costBreakdown: booking.costBreakdown,
      totalAmount: amount, // The remaining balance paid essentially
      paymentMethod: "Site Payment",
      transactionId: booking.transactionId
    });

    res.json({ message: "Site Payment confirmed & locked.", receiptId: receipt._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  initiateEsewaPayment,
  verifyEsewaPayment,
  getUserReceipts,
  getGarageReceipts,
  getReceiptById,
  requestCashPayment,
  confirmCashPayment
};
