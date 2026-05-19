/**
 * Creates the admin user Admin@gmail.com with password "Admin@gmail.com"
 * and sets the profile to admin role with avatar (Japanese woman in her 20s).
 * Reads Supabase URL and service role key from .env.local.
 *
 * Usage: node scripts/create-admin.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

function loadEnv() {
  try {
    const raw = readFileSync(envPath, "utf8");
    const env = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      env[key] = val;
    }
    return env;
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
    process.exit(1);
  }
}

const ADMIN_EMAIL = "Admin@gmail.com";
const ADMIN_PASSWORD = "Admin@gmail.com";
const ADMIN_AVATAR = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&facepad=2";

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Admin", username: "admin" },
  });

  if (authError) {
    if (authError.message.includes("already") || authError.message.includes("exist") || authError.message.includes("duplicate")) {
      console.log("User Admin@gmail.com already exists.");
      console.log("Run the SQL in supabase-complete.sql (section 11) in Supabase Dashboard → SQL Editor to set role=admin and avatar.");
      process.exit(0);
    }
    console.error("Create user error:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email: ADMIN_EMAIL,
    name: "Admin",
    username: "admin",
    avatar_url: ADMIN_AVATAR,
    role: "admin",
    whatsapp: "",
    company: "",
    banned: false,
  });

  if (profileError) {
    console.error("Profile create error:", profileError.message);
    process.exit(1);
  }

  console.log("Admin user created successfully.");
  console.log("  Email:    ", ADMIN_EMAIL);
  console.log("  Password: ", ADMIN_PASSWORD);
  console.log("  User ID:  ", userId);
}

main();
