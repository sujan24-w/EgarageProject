const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Load Environment Variables
dotenv.config();

const http = require("http");
const { Server } = require("socket.io");

// Connect to Database
connectDB();
const Booking = require("./models/booking.model");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log("User connected to live tracking:", socket.id);

  socket.on("join_booking", (bookingId) => {
    socket.join(bookingId);
  });

  socket.on("join_user_room", (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on("join_garage_room", (garageId) => {
    socket.join(`garage_${garageId}`);
  });

  socket.on("join_mechanic_room", (mechanicId) => {
    socket.join(`mechanic_${mechanicId}`);
  });

  socket.on("update_mechanic_location", async (data) => {
    io.to(data.bookingId).emit("mechanic_location_updated", {
      lat: data.lat,
      lng: data.lng
    });
    // Save last known location to DB for persistence when map is reopened
    try {
      await Booking.findByIdAndUpdate(data.bookingId, {
        "mechanicLocation.coordinates": [data.lng, data.lat]
      });
    } catch (err) {
      console.error("Failed to save mechanic location", err);
    }
  });

  // Relays for Notifications
  socket.on("notify_garage", (data) => {
    // data: { garageId, message, type }
    io.to(`garage_${data.garageId}`).emit("incoming_request", data);
  });

  socket.on("notify_mechanic", (data) => {
    io.to(`mechanic_${data.mechanicId}`).emit("new_assignment", data);
  });

  socket.on("notify_status_update", (data) => {
    // data: { userId, garageId, status, message }
    if (data.userId) io.to(`user_${data.userId}`).emit("status_update", data);
    if (data.garageId) io.to(`garage_${data.garageId}`).emit("status_update", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


// Middleware
app.use(express.json());
app.use(cors());

// Basic Route for testing
app.get("/", (req, res) => {
  res.send("E-Garage API is running...");
});

// Import Routes
const authRoutes = require("./routes/auth.routes");
const garageRoutes = require("./routes/garage.routes");
const uploadRoutes = require("./routes/upload.routes");
const mechanicRoutes = require("./routes/mechanic.routes");
const bookingRoutes = require("./routes/booking.routes");
const adminRoutes = require("./routes/admin.routes");
const reviewRoutes = require("./routes/review.routes");
const paymentRoutes = require("./routes/payment.routes");

app.use("/api/auth", authRoutes);
app.use("/api/garages", garageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/mechanics", mechanicRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server & Socket.IO running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
