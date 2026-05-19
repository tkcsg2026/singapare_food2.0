/**
 * Generates favicon from public/pabicon.png into src/app/ so Next.js
 * file-based metadata serves them with cache-busting (correct favicon when deployed).
 * Run: node scripts/gen-favicon.mjs
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const appDir = join(root, "src", "app");
const src = join(publicDir, "pabicon.png");

// Favicon.ico: 32x32 (app/ so Next serves with hash = cache busting)
const size32 = await sharp(src).resize(32, 32).png().toBuffer();
const ico = await pngToIco(size32);
writeFileSync(join(appDir, "favicon.ico"), ico);
console.log("Created src/app/favicon.ico");

// icon.png: 32x32
writeFileSync(join(appDir, "icon.png"), size32);
console.log("Created src/app/icon.png");

// apple-icon.png: 180x180 (Next file convention)
const size180 = await sharp(src).resize(180, 180).png().toBuffer();
writeFileSync(join(appDir, "apple-icon.png"), size180);
console.log("Created src/app/apple-icon.png");
