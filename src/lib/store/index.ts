import "server-only";
import type { Store } from "./types";
import { fileStore } from "./file-store";
import { supabaseStore } from "./supabase-store";

/**
 * Supabase when configured. Otherwise a local JSON file — development only.
 */
export function getStore(): Store {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStore;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FILE_STORE !== "true") {
    throw new Error("Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return fileStore;
}
