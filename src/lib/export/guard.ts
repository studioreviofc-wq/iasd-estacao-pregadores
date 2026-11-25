import "server-only"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types/database"

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * Exportações exigem usuário aprovado com o papel adequado. Os dados também
 * passam pelo RLS — este guard só devolve uma resposta clara.
 */
export async function exportGuard(
  allowed: UserRole[]
): Promise<{ ok: true; supabase: Client } | { ok: false; response: Response }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: new Response("Banco de dados não configurado.", { status: 503 }) }
  }
  const supabase = await createClient()
  const { data: role } = await supabase.rpc("current_user_role")
  if (!role) return { ok: false, response: new Response("Acesso não autorizado.", { status: 401 }) }
  if (!allowed.includes(role)) return { ok: false, response: new Response("Sem permissão para esta exportação.", { status: 403 }) }
  return { ok: true, supabase }
}

export function fileResponse(body: string, filename: string, type: string) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
