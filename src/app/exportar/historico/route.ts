import { brDate, toCsv } from "@/lib/export/csv"
import { exportGuard, fileResponse } from "@/lib/export/guard"
import { todayISO, weekdayOf } from "@/lib/domain/dates"
import { serviceName, servicePeriodLabel } from "@/lib/domain/labels"

/** GET /exportar/historico — pregações realizadas em CSV (membros aprovados). */
export async function GET() {
  const guard = await exportGuard(["administrador", "secretario", "leitor"])
  if (!guard.ok) return guard.response

  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await guard.supabase
      .from("services")
      .select("service_date, service_type, period, title, sermon_title, bible_reference, notes, preacher:preachers(full_name)")
      .eq("status", "realizado")
      .order("service_date", { ascending: false })
      .range(from, from + 999)
    if (error) return new Response(`Erro ao exportar: ${error.message}`, { status: 500 })
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const csv = toCsv(rows, [
    { header: "Data", value: (r) => brDate(r.service_date) },
    { header: "Dia da semana", value: (r) => weekdayOf(r.service_date) },
    { header: "Período", value: (r) => servicePeriodLabel[r.period] },
    { header: "Culto", value: (r) => serviceName(r) },
    { header: "Pregador", value: (r) => (r.preacher as { full_name: string } | null)?.full_name ?? "" },
    { header: "Tema", value: (r) => r.sermon_title },
    { header: "Texto bíblico", value: (r) => r.bible_reference },
    { header: "Observações", value: (r) => r.notes },
  ])
  return fileResponse(csv, `historico-pregacoes-${todayISO()}.csv`, "text/csv; charset=utf-8")
}
