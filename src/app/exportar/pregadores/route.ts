import { brDate, toCsv } from "@/lib/export/csv"
import { exportGuard, fileResponse } from "@/lib/export/guard"
import { todayISO } from "@/lib/domain/dates"
import { preacherCategoryLabel } from "@/lib/domain/labels"
import { weekdaysLabel } from "@/lib/domain/weekdays"

/** GET /exportar/pregadores — cadastro completo em CSV (administração e secretaria). */
export async function GET() {
  const guard = await exportGuard(["administrador", "secretario"])
  if (!guard.ok) return guard.response

  const { data, error } = await guard.supabase.from("preacher_overview").select("*").order("full_name")
  if (error) return new Response(`Erro ao exportar: ${error.message}`, { status: 500 })

  const csv = toCsv(data ?? [], [
    { header: "Nome", value: (p) => p.full_name },
    { header: "Apelido", value: (p) => p.nickname },
    { header: "Telefone", value: (p) => p.phone },
    { header: "WhatsApp", value: (p) => p.whatsapp },
    { header: "E-mail", value: (p) => p.email },
    { header: "Função", value: (p) => preacherCategoryLabel[p.category] },
    { header: "Cargo", value: (p) => p.role_title },
    { header: "Igreja de origem", value: (p) => p.home_church },
    { header: "Dias de preferência", value: (p) => weekdaysLabel(p.preferred_weekdays) },
    { header: "Situação", value: (p) => (p.archived_at ? "Arquivado" : p.is_active ? "Ativo" : "Inativo") },
    { header: "Pregações realizadas", value: (p) => p.total_preached },
    { header: "Última pregação", value: (p) => brDate(p.last_preached_on) },
    { header: "Próxima confirmada", value: (p) => brDate(p.next_confirmed_on) },
    { header: "Observações", value: (p) => p.notes },
    { header: "Cadastrado em", value: (p) => brDate(p.created_at) },
  ])
  return fileResponse(csv, `pregadores-${todayISO()}.csv`, "text/csv; charset=utf-8")
}
