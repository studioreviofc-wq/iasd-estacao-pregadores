import { History } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { siteConfig } from "@/config/site"
import type { AuditLogRow, ProfileRow } from "@/types/database"

const tableLabel: Record<string, string> = {
  preachers: "Pregador",
  services: "Escala",
  availabilities: "Disponibilidade",
  contact_logs: "Contato",
  church_settings: "Configurações",
  profiles: "Usuário",
}
const actionLabel = { insert: "criou", update: "alterou", delete: "excluiu" } as const

const fieldLabel: Record<string, string> = {
  full_name: "nome",
  phone: "telefone",
  whatsapp: "WhatsApp",
  status: "status",
  preacher_id: "pregador",
  is_active: "situação",
  archived_at: "arquivamento",
  notes: "observações",
  approved: "acesso",
  role: "permissão",
  sermon_title: "tema",
  outcome: "resposta",
}

function summary(row: AuditLogRow) {
  if (row.action !== "update" || !row.changes || typeof row.changes !== "object" || Array.isArray(row.changes)) {
    const c = row.changes as Record<string, unknown>
    const name = (c?.full_name ?? c?.title ?? c?.service_date ?? c?.availability_month ?? "") as string
    return name ? String(name) : ""
  }
  return Object.keys(row.changes)
    .map((k) => fieldLabel[k] ?? k)
    .join(", ")
}

/** Registro de alterações (audit_log), mais recente primeiro. */
export function AuditLogList({ rows, users }: { rows: AuditLogRow[]; users: ProfileRow[] }) {
  if (!rows.length) {
    return <EmptyState compact icon={History} title="Nenhuma alteração registrada" />
  }
  const nameOf = new Map(users.map((u) => [u.id, u.full_name || u.email || "Usuário"]))
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: siteConfig.timezone, dateStyle: "short", timeStyle: "short" })

  return (
    <ul className="max-h-96 divide-y divide-border overflow-y-auto text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-3">
          <time className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">{fmt.format(new Date(r.changed_at))}</time>
          <p className="min-w-0">
            <span className="font-medium">{r.changed_by ? (nameOf.get(r.changed_by) ?? "Usuário") : "Sistema"}</span>{" "}
            {actionLabel[r.action]} · {tableLabel[r.table_name] ?? r.table_name}
            {summary(r) ? <span className="text-muted-foreground"> — {summary(r)}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  )
}
