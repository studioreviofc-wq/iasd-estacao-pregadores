"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/database"
import { requireSupabaseEnv } from "./env"

/** Cliente Supabase para Client Components (formulários, ações interativas). */
export function createClient() {
  const { url, key } = requireSupabaseEnv()
  return createBrowserClient<Database>(url, key)
}
