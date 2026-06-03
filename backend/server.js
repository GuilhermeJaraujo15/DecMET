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
import { getAirportByIcao, isValidIcao, normalizeIcao } from "./src/services/airportSeo.service.js";
import { getMetarSwr } from "./src/services/metarSwrCache.service.js";
import { buildSitemapXml } from "./src/services/sitemap.service.js";
import { defaultLang, isSupportedLang, normalizeLang, supportedLangs, t } from "./src/i18n/index.js";
import { decodeMetar } from "./src/utils/metar-decoder.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const app = express();
const PORT = process.env.PORT || 3000;
const defaultFrontendOrigins = [
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
const allowedOrigins = [...new Set([...defaultFrontendOrigins, ...configuredFrontendOrigins])];

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origin not allowed: ${origin}`);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
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

app.get("/estacao/:icao", (req, res) => {
  const icao = normalizeIcao(req.params.icao);
  res.redirect(301, `/${defaultLang}/estacao/${icao}`);
});

app.get("/:lang/estacao/:icao", async (req, res, next) => {
  try {
    const requestedLang = req.params.lang;
    const lang = normalizeLang(requestedLang);
    const icao = normalizeIcao(req.params.icao);

    if (!isSupportedLang(requestedLang)) {
      return res.redirect(301, `/${lang}/estacao/${icao}`);
    }

    if (!isValidIcao(icao)) {
      return renderStationNotFound(res, lang, icao);
    }

    const [airport, metarResult] = await Promise.all([
      getAirportByIcao(icao),
      getMetarForSeo(icao)
    ]);

    if (!airport) {
      return renderStationNotFound(res, lang, icao);
    }

    const rawMetar = metarResult?.data?.rawMetar;
    const decoded = rawMetar ? safelyDecodeMetar(rawMetar, icao) : null;
    const baseUrl = getPublicBaseUrl();
    const canonicalUrl = `${baseUrl}/${lang}/estacao/${icao}`;
    const hreflangs = supportedLangs.map(locale => ({
      lang: locale,
      url: `${baseUrl}/${locale}/estacao/${icao}`
    }));
    const title = buildStationTitle(icao, airport, lang);
    const description = buildStationDescription(icao, airport, lang);

    return res.render("station", {
      lang,
      icao,
      airport,
      metar: metarResult?.data || null,
      metarCache: metarResult?.cache || null,
      decoded,
      title,
      description,
      canonicalUrl,
      hreflangs,
      xDefaultUrl: `${baseUrl}/${defaultLang}/estacao/${icao}`,
      structuredData: buildStationStructuredData({
        icao,
        airport,
        title,
        description,
        canonicalUrl
      }),
      t: key => t(lang, key)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const xml = await buildSitemapXml();
    res.type("application/xml").send(xml);
  } catch (error) {
    next(error);
  }
});

app.get("/robots.txt", (req, res) => {
  const baseUrl = getPublicBaseUrl();

  res.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${baseUrl}/sitemap.xml`
  ].join("\n"));
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
  if (req.accepts("html")) {
    return renderGenericNotFound(res, defaultLang);
  }

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
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(", ")}`);
  console.log(`✓ API endpoints available at /api/aeroportos`);
  console.log(`✓ METAR endpoint available at /api/metar/:icao\n`);
});

async function getMetarForSeo(icao) {
  try {
    return await getMetarSwr(icao);
  } catch (error) {
    console.warn("[SEO] METAR unavailable for station page:", {
      icao,
      code: error.code,
      status: error.status,
      message: error.message
    });

    return null;
  }
}

function safelyDecodeMetar(rawMetar, icao) {
  try {
    return decodeMetar(rawMetar);
  } catch (error) {
    console.warn("[SEO] METAR decode failed for station page:", {
      icao,
      message: error.message
    });

    return null;
  }
}

function buildStationTitle(icao, airport, lang) {
  const airportName = airport?.name || icao;

  if (lang === "en-US") {
    return `METAR ${icao} - ${airportName} | DecMET`;
  }

  return `METAR ${icao} - ${airportName} | DecMET`;
}

function buildStationDescription(icao, airport, lang) {
  const airportName = airport?.name || icao;
  const location = [airport?.municipality, airport?.iso_country].filter(Boolean).join(", ");

  if (lang === "en-US") {
    return `Check real-time METAR, aerodrome data and decoded aviation weather for ${airportName} (${icao})${location ? ` in ${location}` : ""}.`;
  }

  return `Consulte METAR em tempo real, dados do aeródromo e decodificação meteorológica aeronáutica para ${airportName} (${icao})${location ? ` em ${location}` : ""}.`;
}

function buildStationStructuredData({ icao, airport, title, description, canonicalUrl }) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: title,
    description,
    url: canonicalUrl,
    identifier: icao,
    spatialCoverage: airport.latitude_deg !== null && airport.longitude_deg !== null
      ? {
          "@type": "Place",
          name: airport.name,
          geo: {
            "@type": "GeoCoordinates",
            latitude: airport.latitude_deg,
            longitude: airport.longitude_deg
          }
        }
      : {
          "@type": "Place",
          name: airport.name
        },
    provider: {
      "@type": "Organization",
      name: "DecMET",
      url: getPublicBaseUrl()
    }
  };
}

function renderStationNotFound(res, lang, icao) {
  return res.status(404).render("404", {
    lang,
    icao,
    title: `ICAO ${icao || ""} não encontrado | DecMET`,
    description: "Aeródromo não encontrado na base DecMET.",
    heading: t(lang, "error.notFound.title"),
    body: t(lang, "error.notFound.body")
  });
}

function renderGenericNotFound(res, lang) {
  return res.status(404).render("404", {
    lang,
    icao: null,
    title: "Página não encontrada | DecMET",
    description: "Página não encontrada no DecMET.",
    heading: t(lang, "error.notFound.title"),
    body: t(lang, "error.notFound.body")
  });
}

function getPublicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || "https://decmet.com.br").replace(/\/+$/, "");
}
