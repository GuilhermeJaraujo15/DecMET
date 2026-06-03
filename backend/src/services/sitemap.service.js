import NodeCache from "node-cache";
import { getAllSeoIcaos } from "./airportSeo.service.js";
import { supportedLangs } from "../i18n/index.js";

const sitemapCache = new NodeCache({ stdTTL: 6 * 60 * 60, checkperiod: 600 });

export async function buildSitemapXml() {
  const cached = sitemapCache.get("sitemap.xml");
  if (cached) return cached;

  const baseUrl = getPublicBaseUrl();
  const icaos = await getAllSeoIcaos();
  const urls = [];

  for (const icao of icaos) {
    for (const lang of supportedLangs) {
      urls.push(buildUrlEntry(`${baseUrl}/${lang}/estacao/${icao}`));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  sitemapCache.set("sitemap.xml", xml);
  return xml;
}

function buildUrlEntry(loc) {
  const now = new Date().toISOString().split('T')[0]; // Gera data YYYY-MM-DD
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>`;
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
