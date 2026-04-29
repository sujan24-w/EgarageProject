const Review = require("../models/review.model");
const Booking = require("../models/booking.model");
const Garage = require("../models/garage.model");

// @desc    Create a review
// @route   POST /api/reviews
const createReview = async (req, res) => {
  try {
    const { garageId, bookingId, rating, comment } = req.body;
    
    // Verify booking belongs to user and is completed
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id, status: "completed" });
    if (!booking) return res.status(403).json({ message: "You can only review completed services." });

    const review = await Review.create({
      userId: req.user._id,
      garageId,
      bookingId,
      rating: Number(rating),
      comment
    });

    const allReviews = await Review.find({ garageId });
    const totalReviews = allReviews.length;
    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews;
    
    await Garage.findByIdAndUpdate(garageId, {
      rating: parseFloat(avgRating.toFixed(1)),
      totalReviews: totalReviews
    });

    res.status(201).json(review);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Get reviews for a garage
// @route   GET /api/reviews/garage/:garageId
const getGarageReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ garageId: req.params.garageId })
      .populate("userId", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Get logged in garage owner's own reviews
// @route   GET /api/reviews/my-reviews
// @access  Private (Garage)
const getMyReviews = async (req, res) => {
  try {
    const Garage = require("../models/garage.model");
    const garage = await Garage.findOne({ ownerId: req.user._id });
    if(!garage) return res.status(404).json({ message: "Garage profile not found" });

    const reviews = await Review.find({ garageId: garage._id })
      .populate("userId", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Delete review (Admin)
// @route   DELETE /api/reviews/:id
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    
    await review.deleteOne();
    res.json({ message: "Review deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = { createReview, getGarageReviews, getMyReviews, deleteReview };
