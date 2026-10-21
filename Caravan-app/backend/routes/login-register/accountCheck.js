const express = require("express");
const app = express.Router();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

app.customPath = "/api";

app.get("/isLoggedIn", (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const token = req.cookies?.auth || bearerToken;

  if (!token) {
    return res.status(200).json({ loggedIn: false });
  }

  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error || user?.role !== "user") {
      res.clearCookie("auth", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(200).json({ loggedIn: false });
    }

    return res.status(200).json({
      loggedIn: true,
      user,
    });
  });
});


module.exports = app;
