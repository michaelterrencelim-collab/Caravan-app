const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const cookieParser = require("cookie-parser");

const requiredEnvironment = ["TURSO_LINK", "TURSO_TOKEN", "JWT_SECRET"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

if (missingEnvironment.length > 0) {
  throw new Error(
    `Missing required backend environment variables: ${missingEnvironment.join(", ")}. ` +
      "Copy backend/.env.example to backend/.env and fill in the values.",
  );
}

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = new Set([
  "http://localhost",
  "http://localhost:8100",
  "https://localhost",
  "capacitor://localhost",
  "http://10.0.2.2",
  "http://10.0.2.2:3000",
  "https://aqua-barracuda-666660.hostingersite.com",
  "http://aqua-barracuda-666660.hostingersite.com",
  ...(process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

function loadRoutes(directory) {
  for (const file of fs.readdirSync(directory).sort()) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadRoutes(filePath);
      continue;
    }

    if (!file.endsWith(".js")) continue;

    const router = require(filePath);
    const routePrefix = router.customPath || `/${path.basename(file, ".js")}`;
    app.use(routePrefix, router);
    console.log(`Mounted ${path.relative(__dirname, filePath)} -> ${routePrefix}`);
  }
}

loadRoutes(path.join(__dirname, "routes"));

// Serve static Angular web app files if www/ or public/ directory exists
const wwwPath = path.join(__dirname, "../www");
const publicPath = path.join(__dirname, "public");
const staticPath = fs.existsSync(wwwPath)
  ? wwwPath
  : fs.existsSync(publicPath)
  ? publicPath
  : null;

if (staticPath) {
  app.use(express.static(staticPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/healthz") return next();
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }
  if (staticPath) {
    return res.sendFile(path.join(staticPath, "index.html"));
  }
  res.redirect("/");
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Caravan API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
