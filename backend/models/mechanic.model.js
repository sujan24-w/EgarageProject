const mongoose = require("mongoose");

const mechanicSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    image: {
      type: String, // Cloudinary URL
      default: "",
    },
    certificate: {
      type: String, // Cloudinary URL for certificate
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Mechanic", mechanicSchema);
