import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/types/database"
import { requireSupabaseEnv } from "./env"

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Lê cookies da requisição → torna o componente dinâmico (envolva em <Suspense>).
 */
export async function createClient() {
  const { url, key } = requireSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de um Server Component: o proxy renova a sessão.
        }
      },
    },
  })
}
