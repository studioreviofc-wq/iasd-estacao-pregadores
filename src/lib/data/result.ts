import "server-only"

import { connection } from "next/server"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * Resultado padronizado das consultas.
 * - `unconfigured`: Supabase ainda não conectado (modo de configuração)
 * - `error`: falha na consulta (exibida ao usuário, nunca mascarada)
 * - `ok`: dados reais do banco
 */
export type DataResult<T> =
  | { status: "unconfigured"; data: T }
  | { status: "error"; data: T; message: string }
  | { status: "ok"; data: T }

/**
 * Executa uma consulta com o cliente do servidor. `empty` é o valor vazio
 * usado quando não há conexão — nunca dados fictícios.
 */
export async function query<T>(empty: T, run: (supabase: Client) => Promise<T>): Promise<DataResult<T>> {
  // Garante renderização por requisição (datas, sessão) com Cache Components.
  await connection()

  if (!isSupabaseConfigured()) return { status: "unconfigured", data: empty }

  try {
    const supabase = await createClient()
    return { status: "ok", data: await run(supabase) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao consultar o banco."
    console.error("[data]", message)
    return { status: "error", data: empty, message }
  }
}

/** Lança o erro do PostgREST para ser capturado por `query`. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }, fallback: T): T {
  if (res.error) throw new Error(res.error.message)
  return res.data ?? fallback
}

export function unwrapCount(res: { count: number | null; error: { message: string } | null }): number {
  if (res.error) throw new Error(res.error.message)
  return res.count ?? 0
}
