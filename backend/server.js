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
    console.log(`Socket ${socket.id} joined booking room ${bookingId}`);
  });

  socket.on("update_mechanic_location", (data) => {
    // data: { bookingId, lat, lng }
    io.to(data.bookingId).emit("mechanic_location_updated", {
      lat: data.lat,
      lng: data.lng
    });
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
