import { siteConfig } from "@/config/site"
import { exportGuard, fileResponse } from "@/lib/export/guard"
import { todayISO } from "@/lib/domain/dates"

const TABLES = [
  "church_settings",
  "profiles",
  "preachers",
  "services",
  "availabilities",
  "contact_logs",
  "preacher_events",
  "availability_events",
] as const

/**
 * GET /exportar/backup — cópia de segurança completa em JSON (somente administrador).
 * Lê todas as linhas de cada tabela em páginas de 1000.
 */
export async function GET() {
  const guard = await exportGuard(["administrador"])
  if (!guard.ok) return guard.response

  const tables: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await guard.supabase.from(table).select("*").range(from, from + 999)
      if (error) return new Response(`Erro ao ler ${table}: ${error.message}`, { status: 500 })
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    tables[table] = rows
  }

  const backup = {
    format: "iasd-estacao-backup",
    version: 1,
    generated_at: new Date().toISOString(),
    church: siteConfig.churchName,
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    tables,
  }
  return fileResponse(JSON.stringify(backup, null, 2), `backup-iasd-estacao-${todayISO()}.json`, "application/json; charset=utf-8")
}
