const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload.middleware");
const cloudinary = require("../config/cloudinary");
const { isAuthenticated } = require("../middlewares/auth.middleware");

router.post("/", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    // Determine secure upload structure based on User ID
    const type = req.body.type || "misc";
    const userId = req.user._id.toString();

    let folderPath = `egarage/misc/${userId}`;
    if (type === "garage_document") folderPath = `egarage/garages/${userId}/documents`;
    else if (type === "garage_image") folderPath = `egarage/garages/${userId}/images`;
    else if (type === "user_profile") folderPath = `egarage/users/${userId}/profile`;

    // convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: folderPath,
    });

    res.json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/public", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    let folderPath = "egarage/public_uploads";
    
    // convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: folderPath,
    });

    res.json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
