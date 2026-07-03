import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { buildSitemapXml } from "../src/services/sitemap.service.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const outputPath = path.join(projectRoot, "sitemap.xml");

const xml = await buildSitemapXml();
await fs.writeFile(outputPath, xml, "utf8");

console.log(`Sitemap generated at ${outputPath}`);
