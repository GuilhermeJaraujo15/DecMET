/**
 * DecMET Backend Server
 * Provides API endpoints for airport search and METAR decoder
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import aeroportosRoutes from "./src/routes/aeroportos.routes.js";
import metarRoutes from "./src/routes/metar.routes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_FRONTEND_ORIGINS = [
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "null"
];
const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const FRONTEND_ORIGINS = [...new Set([...DEFAULT_FRONTEND_ORIGINS, ...configuredFrontendOrigins])];

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "DecMET backend is running" });
});

// Routes
app.use("/api/aeroportos", aeroportosRoutes);
app.use("/api/metar", metarRoutes);

// Front-end static files
app.use("/pages", express.static(path.join(projectRoot, "pages")));
app.use("/css", express.static(path.join(projectRoot, "css")));
app.use("/js", express.static(path.join(projectRoot, "js")));
app.use("/assets", express.static(path.join(projectRoot, "assets")));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.get(["/about-metar.html", "/pages/about-metar.html"], (req, res) => {
  res.sendFile(path.join(projectRoot, "pages", "sobre-metar.html"));
});

app.get(["/decoder.html", "/pages/decoder.html"], (req, res) => {
  res.sendFile(path.join(projectRoot, "pages", "decodificador.html"));
});

app.get(["/airports.html", "/pages/airports.html"], (req, res) => {
  res.sendFile(path.join(projectRoot, "pages", "aerodromo.html"));
});

app.get(["/metar.html", "/pages/metar.html"], (req, res) => {
  res.sendFile(path.join(projectRoot, "pages", "apiMet.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 DecMET Backend running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${FRONTEND_ORIGINS.join(", ")}`);
  console.log(`✓ API endpoints available at /api/aeroportos`);
  console.log(`✓ METAR endpoint available at /api/metar/:icao\n`);
});
