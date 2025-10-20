// db.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ Missing Supabase credentials: SUPABASE_URL or SUPABASE_KEY"
  );
  process.exit(1);
}

// Create a single reusable Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Supabase client initialized successfully");
