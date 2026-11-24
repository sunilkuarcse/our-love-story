import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

function isServiceRoleKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const tokenParts = key.split(".");
  if (tokenParts.length !== 3) return false;

  try {
    const payload = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return JSON.parse(decoded).role === "service_role";
  } catch {
    return false;
  }
}

function validateSupabaseConfig() {
  if (!supabaseUrl || !supabaseKey) {
    return "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.";
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const isLocalHttp = parsedUrl.protocol === "http:" && parsedUrl.hostname === "localhost";
    if (!isHttps && !isLocalHttp) {
      return "VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.";
    }
    if (parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
      return "VITE_SUPABASE_URL must be the project URL only, without an API path, query, or fragment.";
    }
  } catch {
    return "VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.";
  }

  if (isServiceRoleKey(supabaseKey)) {
    return "A service-role key cannot be used in the browser. Use the Supabase publishable/anon key.";
  }

  if (!supabaseKey.startsWith("sb_publishable_") && !supabaseKey.startsWith("eyJ")) {
    return "VITE_SUPABASE_ANON_KEY must contain a Supabase publishable or anon key.";
  }

  return "";
}

export const supabaseConfigError = validateSupabaseConfig();
export const supabaseConfigured = !supabaseConfigError;
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;