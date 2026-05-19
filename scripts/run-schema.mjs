import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "uwlfjcmzciunetehmicr";
const DB_PASSWORD = process.env.DB_PASSWORD;
const SQL_FILE = join(__dirname, "..", "supabase-schema.sql");
const sql = readFileSync(SQL_FILE, "utf8");

if (!DB_PASSWORD) { console.error("Set DB_PASSWORD env var first."); process.exit(1); }

const { default: pg } = await import("pg");
const { Client } = pg;

const endpoints = [
  // Supavisor transaction pooler (AP Southeast 1) – correct username format
  { host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 6543, user: `postgres.${PROJECT_REF}`, note: "Supavisor TX SEA" },
  // Supavisor session pooler
  { host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 5432, user: `postgres.${PROJECT_REF}`, note: "Supavisor SS SEA" },
  // Pooler direct IPv4 (from DNS)
  { host: "54.255.219.82", port: 6543, user: `postgres.${PROJECT_REF}`, note: "Pooler IPv4 TX" },
  { host: "54.255.219.82", port: 5432, user: `postgres.${PROJECT_REF}`, note: "Pooler IPv4 SS" },
  // Direct DB via IPv6 (actual DNS resolved IP)
  { host: "2406:da1c:f42:ae0f:65f1:ad24:395:98be", port: 5432, user: "postgres", note: "Direct IPv6" },
  // Old-style connection (some older projects)
  { host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 6543, user: "postgres", note: "Old-style TX" },
];

for (const ep of endpoints) {
  const client = new Client({
    host: ep.host, port: ep.port, database: "postgres",
    user: ep.user, password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    process.stdout.write(`Trying ${ep.note}... `);
    await client.connect();
    console.log("CONNECTED ✓");
    console.log("Executing schema SQL (may take a few seconds)...");
    await client.query(sql);
    console.log("\n✅ All tables created successfully!");
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`✗  ${e.message.slice(0, 90)}`);
    try { await client.end(); } catch {}
  }
}

// Last resort: Use Management API REST endpoint with DB password in URL
console.log("\nAttempting Supabase query API...");
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-db-pass": DB_PASSWORD },
  body: JSON.stringify({ query: sql }),
});
console.log("API status:", res.status, await res.text().then(t => t.slice(0, 200)));

console.log(`
❌ All connection methods failed.

Please execute the SQL via the Supabase SQL Editor (30 seconds):
  1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/editor
  2. Open supabase-schema.sql in your editor, Select All + Copy
  3. Paste into SQL Editor → press Ctrl+Enter (or click Run)
  4. Done!
`);
