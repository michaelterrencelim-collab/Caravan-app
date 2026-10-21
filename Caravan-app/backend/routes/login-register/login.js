const express = require("express");
const app = express.Router();

const db = require("../../imports/database");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

app.customPath = "/api";

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const result = await db.execute({
      sql: `
        SELECT *
        FROM Customer
        WHERE Cus_email = ?
        AND Cus_password = ?
      `,
      args: [email, password],
    });

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const accountStatus = String(user.Status || "Enabled").trim().toLowerCase();
    if (!["enabled", "active"].includes(accountStatus)) {
      res.clearCookie("auth", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(403).json({
        error: "Your account is disabled. Please reach out to the Caravan team.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.Customer_id,
        email: user.Cus_email,
        role: "user",
      },
      JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );

    // Store JWT in HTTP-only cookie
    res.cookie("auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Don't need to send the JWT back to JavaScript anymore
    return res.json({
      role: "user",
      token,
    });
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      error: "Server error",
    });
  }
});

module.exports = app;
