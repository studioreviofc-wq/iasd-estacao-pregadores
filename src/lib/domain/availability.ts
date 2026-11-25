import type { AvailabilityStatus } from "@/types/database"

import { fromISODate } from "./dates"

export type AvailabilityWindowLike = {
  preacher_id: string
  start_date: string
  end_date: string
  specific_dates: string[]
  weekdays: number[]
  status?: AvailabilityStatus
}

/** Espelha public.availability_covers(): período + datas específicas + dias da semana. */
export function availabilityCovers(a: Omit<AvailabilityWindowLike, "preacher_id">, date: string): boolean {
  if (date < a.start_date || date > a.end_date) return false
  if (a.specific_dates.length && !a.specific_dates.includes(date)) return false
  if (a.weekdays.length && !a.weekdays.includes(fromISODate(date).getDay())) return false
  return true
}

/** Disponibilidade ainda utilizável para escala (não agendada/indisponível). */
export function isOpenAvailability(status: AvailabilityStatus | undefined) {
  return !status || status === "informada" || status === "aguardando_confirmacao"
}

/** IDs dos pregadores disponíveis numa data. */
export function availablePreacherIds(windows: AvailabilityWindowLike[], date: string): Set<string> {
  const ids = new Set<string>()
  for (const w of windows) {
    if (isOpenAvailability(w.status) && availabilityCovers(w, date)) ids.add(w.preacher_id)
  }
  return ids
}
