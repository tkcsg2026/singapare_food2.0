/**
 * Runs supabase/new_all.sql against the Supabase database — the combined
 * schema migration (shop listings, community + wanted sides, auto-post).
 * Tries multiple connection endpoints in order.
 *
 * Usage:
 *   node scripts/run-community-sql.mjs
 *
 * Set the DB password via environment variable before running:
 *   PowerShell: $env:DB_PASSWORD="your-db-password"
 *               $env:SUPABASE_PROJECT_REF="your-project-ref"
 *   Then:       node scripts/run-community-sql.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first"); // Force IPv4 resolution

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE  = join(__dirname, "..", "supabase", "new_all.sql");
const SQL       = readFileSync(SQL_FILE, "utf8");
const PASSWORD  = process.env.DB_PASSWORD;
const PROJECT   = process.env.SUPABASE_PROJECT_REF;

if (!PASSWORD || !PROJECT) {
  console.error("Set DB_PASSWORD and SUPABASE_PROJECT_REF env vars first.");
  process.exit(1);
}

const ENDPOINTS = [
  { label: "Pooler session (ap-southeast-1)", host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT}` },
  { label: "Pooler txn    (ap-southeast-1)", host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT}` },
  { label: "Pooler session (us-east-1)",      host: `aws-0-us-east-1.pooler.supabase.com`,      port: 5432, user: `postgres.${PROJECT}` },
  { label: "Pooler session (us-west-1)",      host: `aws-0-us-west-1.pooler.supabase.com`,      port: 5432, user: `postgres.${PROJECT}` },
  { label: "Direct (IPv4 forced)",            host: `db.${PROJECT}.supabase.co`,                port: 5432, user: "postgres" },
];

async function tryEndpoint(ep) {
  // Dynamic import of pg so we don't crash if it's not installed
  let pg;
  try { pg = await import("pg"); } catch {
    console.error("pg not installed. Run: npm install pg");
    process.exit(1);
  }
  const { Client } = pg.default ?? pg;

  const client = new Client({
    host:     ep.host,
    port:     ep.port,
    database: "postgres",
    user:     ep.user,
    password: PASSWORD,
    ssl:      { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    process.stdout.write(`  Trying ${ep.label} ... `);
    await client.connect();
    console.log("connected ✓");

    console.log("  Running SQL...");
    await client.query(SQL);
    console.log("  ✅ new_all.sql executed successfully!");

    const threads = await client.query(`SELECT COUNT(*) AS rows FROM public.community_threads;`);
    const replies = await client.query(`SELECT COUNT(*) AS rows FROM public.community_replies;`);
    console.log(`\n  community_threads row count: ${threads.rows[0].rows}`);
    console.log(`  community_replies row count: ${replies.rows[0].rows}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`failed: ${err.message.slice(0, 100)}`);
    try { await client.end(); } catch {}
    return false;
  }
}

console.log(`\nRunning new_all.sql against project: ${PROJECT}\n`);
let success = false;
for (const ep of ENDPOINTS) {
  success = await tryEndpoint(ep);
  if (success) break;
}

if (!success) {
  console.log(`
  ❌ All connection attempts failed.

  ══════════════════════════════════════════════════════════════
  MANUAL OPTION (takes 30 seconds):
  ══════════════════════════════════════════════════════════════
  1. Open: https://supabase.com/dashboard/project/${PROJECT}/sql
  2. Click "New query"
  3. Open file: supabase/new_all.sql  (${SQL_FILE})
  4. Select all → paste → click Run
  ══════════════════════════════════════════════════════════════
  `);
  process.exit(1);
}
