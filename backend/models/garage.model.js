const mongoose = require("mongoose");

const garageSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0],
      },
      address: {
        type: String,
        required: true,
      }
    },
    images: {
      type: [String], // user display gallery
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    documents: {
      type: [String], // admin verification docs
      default: [],
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    timing: {
      is24_7: { type: Boolean, default: true },
      openTime: { type: String, default: "09:00" },
      closeTime: { type: String, default: "18:00" },
      closedDays: { type: [String], default: [] }
    },
  },
  { timestamps: true }
);

// Critical geospatial index
garageSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Garage", garageSchema);