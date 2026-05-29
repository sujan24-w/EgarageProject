const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const isAuthenticated = async (req, res, next) => { 
  let token;

  if ( 
    req.headers.authorization && 
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select("-password");
  
      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ message: "Not authorized, user not found or inactive" });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

const isGarageOwner = (req, res, next) => {
  if (req.user && (req.user.role === "garage_owner" || req.user.role === "admin")) {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as garage owner" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as admin" });
  }
};

module.exports = { isAuthenticated, isGarageOwner, isAdmin };
