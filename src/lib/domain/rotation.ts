import { addMonths, differenceInCalendarDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { availabilityCovers, isOpenAvailability, type AvailabilityWindowLike } from "./availability"
import { formatDate, fromISODate } from "./dates"
import type { Tone } from "./labels"

/**
 * Regras de rotatividade. Todas as contas usam a DATA DO CULTO em organização,
 * não a data de hoje.
 *
 *   nunca pregou ............ prioridade alta
 *   ≥ 90 dias ............... prioridade alta
 *   60–89 dias .............. disponível
 *   30–59 dias .............. pregação recente
 *   < intervalo mínimo ...... evitar repetição (padrão 30 dias, configurável)
 *   mês anterior ............ alerta de repetição (regra configurável)
 *   mesmo dia e período ..... conflito (bloqueado pelo banco)
 */

export type RotationSettings = { minIntervalDays: number; consecutiveMonthAlert: boolean }

export const DEFAULT_ROTATION: RotationSettings = { minIntervalDays: 30, consecutiveMonthAlert: true }

export type RotationSnapshot = {
  preacher_id: string
  last_realized_before: string | null
  last_before: string | null
  next_after: string | null
  month_count: number
  prev_month_count: number
  conflict: boolean
  same_day_other: boolean
}

export type RotationCategory = "nunca" | "alta" | "disponivel" | "recente" | "evitar" | "alerta"

export const rotationCategoryMeta: Record<RotationCategory, { label: string; tone: Tone }> = {
  nunca: { label: "Nunca pregou · prioridade alta", tone: "success" },
  alta: { label: "Prioridade alta", tone: "success" },
  disponivel: { label: "Disponível", tone: "brand" },
  recente: { label: "Pregação recente", tone: "warning" },
  evitar: { label: "Evitar repetição", tone: "danger" },
  alerta: { label: "Alerta de repetição", tone: "danger" },
}

export type RotationAssessment = {
  category: RotationCategory
  /** Dias entre a última pregação/escala anterior e o culto (null = nunca). */
  daysSince: number | null
  /** Alertas que exigem confirmação para escalar. */
  warnings: string[]
  /** Informações neutras (não exigem confirmação). */
  notes: string[]
  /** Conflito de escala simultânea — não pode ser escalado. */
  blocked: string | null
}

function monthName(date: string, offset = 0) {
  return format(addMonths(fromISODate(date), offset), "MMMM", { locale: ptBR })
}

const ON_WEEKDAY = ["aos domingos", "às segundas", "às terças", "às quartas", "às quintas", "às sextas", "aos sábados"]

export function assessRotation(
  snap: RotationSnapshot | undefined,
  serviceDate: string,
  settings: RotationSettings = DEFAULT_ROTATION
): RotationAssessment {
  const warnings: string[] = []
  const notes: string[] = []
  if (!snap) return { category: "nunca", daysSince: null, warnings, notes, blocked: null }

  const min = settings.minIntervalDays
  const daysSince = snap.last_before ? differenceInCalendarDays(fromISODate(serviceDate), fromISODate(snap.last_before)) : null
  const daysUntil = snap.next_after ? differenceInCalendarDays(fromISODate(snap.next_after), fromISODate(serviceDate)) : null

  let category: RotationCategory =
    daysSince === null ? "nunca" : daysSince >= 90 ? "alta" : daysSince >= 60 ? "disponivel" : "recente"

  if (daysSince !== null && daysSince < min) {
    category = "evitar"
    warnings.push(`Pregou ou foi escalado em ${formatDate(snap.last_before!, "dd/MM")}, ${daysSince} dias antes deste culto (mínimo recomendado: ${min} dias).`)
  }
  if (daysUntil !== null && daysUntil < min) {
    category = "evitar"
    warnings.push(`Já está escalado em ${formatDate(snap.next_after!, "dd/MM")}, ${daysUntil} dias depois deste culto.`)
  }
  if (settings.consecutiveMonthAlert && snap.prev_month_count > 0) {
    if (category !== "evitar") category = "alerta"
    warnings.push(`Pregou ou está confirmado em ${monthName(serviceDate, -1)} (mês anterior) — meses consecutivos.`)
  }
  if (snap.month_count > 0) {
    notes.push(`Já tem ${snap.month_count} ${snap.month_count === 1 ? "escala" : "escalas"} em ${monthName(serviceDate)}.`)
  }
  if (snap.same_day_other) notes.push("Também está escalado neste dia em outro período.")

  return {
    category,
    daysSince,
    warnings,
    notes,
    blocked: snap.conflict ? "Já está escalado neste mesmo dia e período." : null,
  }
}

export type SuggestionInput = {
  preacher: { id: string; full_name: string; preferred_weekdays: number[]; is_active: boolean }
  snapshot?: RotationSnapshot
}

export type Suggestion = {
  preacherId: string
  name: string
  assessment: RotationAssessment
  reasons: string[]
  availableInMonth: boolean
  weekdayMatch: boolean
}

/**
 * Ordena pregadores para uma data de culto, nesta ordem de prioridade:
 *  1. informaram disponibilidade para o mês
 *  2. disponíveis no dia da semana do culto
 *  3. nunca pregaram
 *  4. há mais tempo sem pregar
 *  5. sem outras escalas no mesmo mês
 * Conflitos vão para o fim; alertas de repetição ficam depois dos demais.
 * Apenas sugere — nunca escala nem confirma.
 */
export function suggestPreachers(
  inputs: SuggestionInput[],
  availability: (AvailabilityWindowLike & { availability_month?: string })[],
  serviceDate: string,
  settings: RotationSettings = DEFAULT_ROTATION
): Suggestion[] {
  const dow = fromISODate(serviceDate).getDay()
  const monthKey = serviceDate.slice(0, 7)

  const list = inputs
    .filter((i) => i.preacher.is_active)
    .map((i) => {
      const own = availability.filter((a) => a.preacher_id === i.preacher.id && isOpenAvailability(a.status))
      const availableInMonth = own.some((a) => (a.availability_month ?? a.start_date).slice(0, 7) === monthKey)
      const coversDate = own.some((a) => availabilityCovers(a, serviceDate))
      const weekdayMatch =
        coversDate || i.preacher.preferred_weekdays.includes(dow) || own.some((a) => a.weekdays.includes(dow))
      const assessment = assessRotation(i.snapshot, serviceDate, settings)

      const reasons: string[] = []
      if (coversDate) reasons.push("Informou disponibilidade para esta data")
      else if (availableInMonth) reasons.push(`Informou disponibilidade para ${monthName(serviceDate)}`)
      if (!coversDate && weekdayMatch) reasons.push(`Disponível ${ON_WEEKDAY[dow]}`)
      if (assessment.daysSince === null) reasons.push("Nunca pregou")
      else if (assessment.daysSince >= 60) reasons.push(`Sem pregar há ${assessment.daysSince} dias`)
      if (!i.snapshot || i.snapshot.month_count === 0) reasons.push(`Nenhuma outra escala em ${monthName(serviceDate)}`)

      return { preacherId: i.preacher.id, name: i.preacher.full_name, assessment, reasons, availableInMonth, weekdayMatch }
    })

  const rank = (s: Suggestion) => [
    s.assessment.blocked ? 1 : 0,
    s.assessment.warnings.length ? 1 : 0,
    s.availableInMonth ? 0 : 1,
    s.weekdayMatch ? 0 : 1,
    s.assessment.daysSince === null ? 0 : 1,
    -(s.assessment.daysSince ?? Number.MAX_SAFE_INTEGER),
    inputs.find((i) => i.preacher.id === s.preacherId)?.snapshot?.month_count ?? 0,
  ]

  return list.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return a.name.localeCompare(b.name, "pt-BR")
  })
}
