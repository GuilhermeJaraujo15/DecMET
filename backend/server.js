import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import "./src/config/env.js";
import { configureApiApp, installApiFinalHandlers } from "./src/app.js";
import { registerLocalStaticFrontend } from "./src/local-static.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const app = express();
const PORT = process.env.PORT || 3000;

configureApiApp(app);
registerLocalStaticFrontend(app, publicDir);
installApiFinalHandlers(app, {
  html404Path: path.join(publicDir, "404.html")
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 DecMET Backend running on port ${PORT}`);
  console.log(`✓ API endpoints available at /api/aeroportos`);
  console.log(`✓ METAR endpoint available at /api/metar/:icao\n`);
});

export default app;
