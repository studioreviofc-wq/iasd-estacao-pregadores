import { addMonths, endOfMonth, format, isValid, parse, startOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

import { siteConfig } from "@/config/site"

/** Data de hoje (yyyy-MM-dd) no fuso da igreja. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Converte "yyyy-MM-dd" em Date local (sem deslocamento de fuso). */
export function fromISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export type MonthRef = {
  /** "yyyy-MM" */
  key: string
  start: string
  end: string
  label: string
  date: Date
}

export function monthRef(date: Date): MonthRef {
  const start = startOfMonth(date)
  return {
    key: format(start, "yyyy-MM"),
    start: toISODate(start),
    end: toISODate(endOfMonth(start)),
    label: format(start, "MMMM 'de' yyyy", { locale: ptBR }),
    date: start,
  }
}

/** Lê o parâmetro `?mes=yyyy-MM`; usa o mês corrente se ausente ou inválido. */
export function resolveMonth(param: string | string[] | undefined): MonthRef {
  const raw = Array.isArray(param) ? param[0] : param
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const parsed = parse(raw, "yyyy-MM", new Date())
    if (isValid(parsed)) return monthRef(parsed)
  }
  return monthRef(fromISODate(todayISO()))
}

export function shiftMonth(ref: MonthRef, amount: number): MonthRef {
  return monthRef(addMonths(ref.date, amount))
}

export function formatDate(value: string, pattern = "dd 'de' MMM"): string {
  return format(fromISODate(value), pattern, { locale: ptBR })
}

export function formatWeekday(value: string): string {
  return format(fromISODate(value), "EEEE", { locale: ptBR })
}

export function formatTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Faixa de meses do calendário ("yyyy-MM", inclusiva). */
export type ScheduleRange = { start: string; end: string }

function clampKey(key: string, range: ScheduleRange) {
  return key < range.start ? range.start : key > range.end ? range.end : key
}

/**
 * Mês a exibir dentro da faixa da escala: `?mes=` válido ou o mês corrente,
 * sempre limitado ao intervalo configurado (ex.: novembro/2026 → dezembro/2026).
 */
export function resolveMonthInRange(param: string | string[] | undefined, range: ScheduleRange): MonthRef {
  const ref = resolveMonth(param)
  const key = clampKey(ref.key, range)
  return key === ref.key ? ref : monthRef(fromISODate(`${key}-01`))
}

/** Todos os meses da faixa, em ordem. */
export function monthsInRange(range: ScheduleRange): MonthRef[] {
  const out: MonthRef[] = []
  let current = monthRef(fromISODate(`${range.start}-01`))
  while (current.key <= range.end && out.length < 240) {
    out.push(current)
    current = shiftMonth(current, 1)
  }
  return out
}

export const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

export function weekdayOf(value: string): string {
  return weekdayLabels[fromISODate(value).getDay()]
}
