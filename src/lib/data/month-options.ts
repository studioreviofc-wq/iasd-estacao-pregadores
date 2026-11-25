import "server-only"

import type { MonthOption } from "@/components/availability/availability-fields"
import { capitalize, monthsInRange, todayISO } from "@/lib/domain/dates"

import { getScheduleRange } from "./settings"

/** Meses selecionáveis em contatos/disponibilidades: do mês atual até o fim da faixa da escala. */
export async function getMonthOptions(): Promise<MonthOption[]> {
  const range = await getScheduleRange()
  const current = todayISO().slice(0, 7)
  const start = current > range.start ? current : range.start
  const end = range.end < start ? start : range.end
  return monthsInRange({ start, end }).map((m) => ({ key: m.key, label: capitalize(m.label) }))
}
