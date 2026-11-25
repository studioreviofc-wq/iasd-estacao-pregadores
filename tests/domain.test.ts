/**
 * Testes das regras de telefone, WhatsApp e duplicados (espelham o banco).
 * Uso: npm run test:unit
 */
import { normalizeBrPhone, validateBrPhone, formatBrPhone, whatsappUrl, renderWhatsappTemplate } from "../src/lib/domain/phone"
import { findDuplicates } from "../src/lib/domain/duplicates"
import { availabilityCovers, availablePreacherIds } from "../src/lib/domain/availability"
import { availableDaysLabel } from "../src/lib/domain/availability-format"
import { availabilityRows, contactSchema } from "../src/lib/validation/contact"
import { toCsv, brDate } from "../src/lib/export/csv"
import { serviceSchema } from "../src/lib/validation/service"
import { assessRotation, suggestPreachers, type RotationSnapshot } from "../src/lib/domain/rotation"
let fail = 0
const eq = (a: unknown, b: unknown, m: string) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(ok ? "  ✓" : "  ✗", m, ok ? "" : `(obtido ${JSON.stringify(a)})`) }
eq(normalizeBrPhone("(82) 99999-1234"), "82999991234", "máscara")
eq(normalizeBrPhone("+55 (82) 99999-1234"), "82999991234", "código do país")
eq(normalizeBrPhone("082999991234"), "82999991234", "zero de operadora")
eq(normalizeBrPhone("(55) 99999-1234"), "55999991234", "DDD 55 preservado")
eq(validateBrPhone("(82) 99999-1234"), null, "celular válido")
eq(validateBrPhone("(82) 3333-4444"), null, "fixo válido")
eq(validateBrPhone(""), "Informe o telefone com DDD.", "vazio")
eq(validateBrPhone("(20) 99999-1234"), "DDD 20 não existe.", "DDD inexistente")
eq(validateBrPhone("(82) 89999-1234"), "Celular com 11 dígitos deve começar com 9 após o DDD.", "celular sem 9")
eq(validateBrPhone("99999-1234") !== null, true, "sem DDD rejeitado")
eq(formatBrPhone("82999991234"), "(82) 99999-1234", "formata celular")
eq(formatBrPhone("8233334444"), "(82) 3333-4444", "formata fixo")
eq(whatsappUrl("(82) 99999-1234", "Olá, João!"), "https://wa.me/5582999991234?text=Ol%C3%A1%2C%20Jo%C3%A3o!", "link wa.me")
eq(renderWhatsappTemplate("Olá, {primeiro_nome}! {igreja}", { nome: "João da Silva", igreja: "IASD Estação" }), "Olá, João! IASD Estação", "modelo")
const base = [
  { id: "1", full_name: "José Antônio Souza", phone: "(82) 99999-1234", phone_normalized: "82999991234", archived_at: null },
  { id: "2", full_name: "Maria Lima", phone: "(82) 98888-0000", phone_normalized: "82988880000", archived_at: "x" },
]
eq(findDuplicates(base, { full_name: "Outro Nome", phone: "+55 82 99999-1234" }).map(d => d.reason), ["mesmo telefone"], "duplicado por telefone normalizado")
eq(findDuplicates(base, { full_name: "jose antonio souza", phone: "" }).map(d => d.reason), ["mesmo nome"], "duplicado por nome sem acento")
eq(findDuplicates(base, { full_name: "José Souza", phone: "" }).map(d => d.reason), ["nome parecido"], "primeiro + último nome")
eq(findDuplicates(base, { full_name: "Maria Lima", phone: "" })[0]?.archived, true, "inclui arquivados")
eq(findDuplicates(base, { full_name: "José Antônio Souza", phone: "(82) 99999-1234", excludeId: "1" }).length, 0, "ignora o próprio cadastro")
// Disponibilidade
const jan = { preacher_id: "p", start_date: "2027-01-01", end_date: "2027-01-31", specific_dates: [] as string[], weekdays: [6, 0] }
eq(availabilityCovers(jan, "2027-01-02"), true, "sábado dentro do mês coberto")
eq(availabilityCovers(jan, "2027-01-06"), false, "quarta fora dos dias informados")
eq(availabilityCovers(jan, "2027-02-06"), false, "fora do mês")
const mar = { preacher_id: "q", start_date: "2027-03-06", end_date: "2027-03-20", specific_dates: ["2027-03-06", "2027-03-20"], weekdays: [] as number[] }
eq(availabilityCovers(mar, "2027-03-13"), false, "data específica: só as datas informadas")
eq([...availablePreacherIds([jan, { ...mar, status: "agendado" as const }], "2027-03-06")], [], "agendada não aparece como disponível")
eq(availableDaysLabel(mar), "06/03, 20/03", "rótulo de datas específicas")
eq(availableDaysLabel(jan), "Dom, Sáb", "rótulo de dias da semana")
eq(availableDaysLabel({ specific_dates: [], weekdays: [] }), "Qualquer dia do mês", "sem restrição")
eq(
  availabilityRows({ av_months: ["2027-03", "2027-01"], av_dates: ["2027-03-06"], av_weekdays: [6, 6, 0], av_notes: null, av_follow_up_on: null }).map(
    (r) => [r.availability_month, r.specific_dates.join(","), r.weekdays.join(",")]
  ),
  [["2027-01-01", "", "0,6"], ["2027-03-01", "2027-03-06", "0,6"]],
  "vários meses viram um registro por mês"
)
const base2 = { preacher_id: "3f2b8c1e-4d5a-4b6c-9e7f-1a2b3c4d5e6f", channel: "whatsapp", contacted_on: "2026-11-24", target: "mes", invited_for_month: "2026-12" }
eq(contactSchema.safeParse({ ...base2, outcome: "outro_mes" }).success, false, "“Disponível em outro mês” exige ao menos um mês")
eq(contactSchema.safeParse({ ...base2, outcome: "outro_mes", av_months: ["2027-02"], av_dates: ["2027-03-01"] }).success, false, "data fora dos meses selecionados é rejeitada")
eq(contactSchema.safeParse({ ...base2, outcome: "outro_mes", av_months: ["2027-02"] }).success, true, "contato com disponibilidade válida")
eq(contactSchema.safeParse({ ...base2, outcome: "aguardando", target: "culto" }).success, false, "convite para culto exige o culto")

// Rotatividade (sempre relativa à data do culto)
const snap = (o: Partial<RotationSnapshot>): RotationSnapshot => ({
  preacher_id: "x", last_realized_before: null, last_before: null, next_after: null, month_count: 0, prev_month_count: 0, conflict: false, same_day_other: false, ...o,
})
const day = "2027-03-13"
eq(assessRotation(snap({}), day).category, "nunca", "nunca pregou → prioridade alta")
eq(assessRotation(snap({ last_before: "2026-12-13" }), day).category, "alta", "90 dias ou mais → prioridade alta")
eq(assessRotation(snap({ last_before: "2027-01-12" }), day).category, "disponivel", "60–89 dias → disponível")
eq(assessRotation(snap({ last_before: "2027-02-11" }), day).category, "recente", "30–59 dias → pregação recente")
const recent = assessRotation(snap({ last_before: "2027-03-06" }), day)
eq([recent.category, recent.warnings.length], ["evitar", 1], "menos de 30 dias → evitar repetição (com alerta)")
eq(assessRotation(snap({ last_before: "2027-03-06" }), "2027-05-10").category, "disponivel", "conta a partir da data do culto, não de hoje")
eq(assessRotation(snap({ next_after: "2027-03-20" }), day).category, "evitar", "escala futura próxima também evita repetição")
const consec = assessRotation(snap({ last_before: "2027-02-01", prev_month_count: 1 }), day)
eq([consec.category, consec.warnings.some((w) => w.includes("fevereiro"))], ["alerta", true], "mês anterior → alerta de repetição")
eq(assessRotation(snap({ last_before: "2027-02-01", prev_month_count: 1 }), day, { minIntervalDays: 30, consecutiveMonthAlert: false }).category, "recente", "regra de meses consecutivos desligável")
eq(assessRotation(snap({ last_before: "2027-02-11" }), day, { minIntervalDays: 45, consecutiveMonthAlert: true }).category, "evitar", "intervalo mínimo configurável (45 dias)")
eq(assessRotation(snap({ conflict: true }), day).blocked !== null, true, "conflito no mesmo dia/período bloqueia")

const people = [
  { preacher: { id: "recente", full_name: "Recente", preferred_weekdays: [], is_active: true }, snapshot: snap({ preacher_id: "recente", last_before: "2027-03-06" }) },
  { preacher: { id: "antigo", full_name: "Antigo", preferred_weekdays: [], is_active: true }, snapshot: snap({ preacher_id: "antigo", last_before: "2026-10-01" }) },
  { preacher: { id: "novo", full_name: "Novo", preferred_weekdays: [], is_active: true }, snapshot: snap({ preacher_id: "novo" }) },
  { preacher: { id: "sabado", full_name: "Prefere Sábado", preferred_weekdays: [6], is_active: true }, snapshot: snap({ preacher_id: "sabado", last_before: "2026-12-01" }) },
  { preacher: { id: "disp", full_name: "Disponível no Mês", preferred_weekdays: [], is_active: true }, snapshot: snap({ preacher_id: "disp", last_before: "2027-01-01" }) },
  { preacher: { id: "conflito", full_name: "Conflito", preferred_weekdays: [], is_active: true }, snapshot: snap({ preacher_id: "conflito", conflict: true }) },
  { preacher: { id: "inativo", full_name: "Inativo", preferred_weekdays: [], is_active: false } },
]
const avs = [{ preacher_id: "disp", availability_month: "2027-03-01", start_date: "2027-03-01", end_date: "2027-03-31", specific_dates: [], weekdays: [], status: "informada" as const }]
const order = suggestPreachers(people, avs, day).map((s) => s.preacherId)
eq(order, ["disp", "sabado", "novo", "antigo", "recente", "conflito"], "ordem: disponibilidade → dia da semana → nunca pregou → mais tempo sem pregar → alertas → conflito")
eq(suggestPreachers(people, avs, day)[0].reasons[0], "Informou disponibilidade para esta data", "motivo da recomendação explicado")

// CSV
const csv = toCsv([{ n: "José; \"Zé\"", d: "2026-12-05" }], [{ header: "Nome", value: (r) => r.n }, { header: "Data", value: (r) => brDate(r.d) }])
eq(csv, '\uFEFFNome;Data\r\n"José; ""Zé""";05/12/2026\r\n', "CSV com BOM, ponto e vírgula e aspas escapadas")

// Pregador digitado direto no culto (sem cadastro prévio)
const svcId = "3f2b8c1e-4d5a-4b6c-9e7f-1a2b3c4d5e70"
const typed = serviceSchema.safeParse({ id: svcId, status: "confirmado", preacher_id: "none", new_preacher_name: "Teté", new_preacher_church: "Central" })
eq(typed.success && [typed.data.new_preacher_name, typed.data.status], ["Teté", "confirmado"], "culto aceita pregador digitado com status confirmado")
const typedOpen = serviceSchema.safeParse({ id: svcId, status: "aberto", preacher_id: "none", new_preacher_name: "Elionai" })
eq(typedOpen.success && typedOpen.data.status, "convidado", "nome digitado numa vaga em aberto vira aguardando confirmação")
eq(serviceSchema.safeParse({ id: svcId, status: "confirmado", preacher_id: "none" }).success, false, "confirmado sem pregador continua bloqueado")

console.log(fail ? "FALHOU" : "Todos os testes passaram.")
process.exitCode = fail ? 1 : 0
