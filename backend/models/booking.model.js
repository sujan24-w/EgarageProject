const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
    },
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mechanic",
      default: null,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    type: { // "immediate" (flat tire), "towing", or "standard"
      type: String,
      enum: ["immediate", "towing", "standard"],
      required: true,
    },
    issueLocation: { // only used if type === "immediate"
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      },
      address: String
    },
    mechanicLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    vehicleBrand: { type: String },
    vehicleModel: { type: String },
    issueImages: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "in-progress", "completed", "rejected", "cancelled"],
      default: "pending",
    },
    appointmentDate: { // only used for "standard" booking
      type: Date,
    },
    costBreakdown: [
      {
        item: { type: String, required: true },
        price: { type: Number, required: true },
      }
    ],
    totalAmount: {
      type: Number,
      default: 0,
    },
    advanceAmountPaid: {
      type: Number,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    transactionId: {
      type: String,
    }
  },
  { timestamps: true }
);

// Geospatial index for immediate requests tracking
bookingSchema.index({ issueLocation: "2dsphere" });

module.exports = mongoose.model("Booking", bookingSchema);
