import NodeCache from "node-cache";
import { getAllSeoIcaos } from "./airportSeo.service.js";
import { supportedLangs } from "../i18n/index.js";

const SITEMAP_CACHE_KEY = "sitemap.xml";
const SITEMAP_TTL_SECONDS = 6 * 60 * 60;
const sitemapCache = new NodeCache({ stdTTL: SITEMAP_TTL_SECONDS, checkperiod: 600 });

const staticPages = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about-metar.html", changefreq: "monthly", priority: "0.7" },
  { path: "/decoder.html", changefreq: "weekly", priority: "0.8" },
  { path: "/airports.html", changefreq: "weekly", priority: "0.8" },
  { path: "/metar.html", changefreq: "weekly", priority: "0.8" }
];

export async function buildSitemapXml() {
  const cached = sitemapCache.get(SITEMAP_CACHE_KEY);
  if (cached) return cached;

  const baseUrl = getPublicBaseUrl();
  const lastmod = getTodayIsoDate();
  const urls = [];

  for (const page of staticPages) {
    urls.push(buildUrlEntry({
      loc: `${baseUrl}${page.path}`,
      lastmod,
      changefreq: page.changefreq,
      priority: page.priority
    }));
  }

  const icaos = await getAllSeoIcaos();

  for (const icao of icaos) {
    for (const lang of supportedLangs) {
      urls.push(buildUrlEntry({
        loc: `${baseUrl}/${lang}/estacao/${icao}`,
        lastmod,
        changefreq: "hourly",
        priority: "0.8"
      }));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  sitemapCache.set(SITEMAP_CACHE_KEY, xml);
  return xml;
}

function buildUrlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function getPublicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || "https://decmet.com.br").replace(/\/+$/, "");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
