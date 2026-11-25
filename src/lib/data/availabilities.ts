import "server-only"

import { addMonths, format } from "date-fns"

import { fromISODate, todayISO } from "@/lib/domain/dates"
import type { AvailabilityOverviewRow, AvailabilityRow } from "@/types/database"

import { query, unwrap } from "./result"

/** Disponibilidades a partir de alguns meses atrás (para mostrar as expiradas recentes). */
export async function listAvailabilityOverview(monthsBack = 2) {
  return query<AvailabilityOverviewRow[]>([], async (supabase) => {
    const from = format(addMonths(fromISODate(todayISO()), -monthsBack), "yyyy-MM-01")
    const res = await supabase
      .from("availability_overview")
      .select("*")
      .gte("availability_month", from)
      .is("preacher_archived_at", null)
      .order("availability_month")
      .order("preacher_name")
    return unwrap(res, [])
  })
}

/** Disponibilidades vigentes que cruzam um período (painel do calendário / dashboard). */
export async function listOpenAvailabilityBetween(start: string, end: string) {
  return query<AvailabilityOverviewRow[]>([], async (supabase) => {
    const res = await supabase
      .from("availability_overview")
      .select("*")
      .lte("start_date", end)
      .gte("end_date", start)
      .in("effective_status", ["informada", "aguardando_confirmacao"])
      .is("preacher_archived_at", null)
      .order("preacher_name")
    return unwrap(res, [])
  })
}

export type AvailabilityWindow = Pick<
  AvailabilityRow,
  "preacher_id" | "availability_month" | "start_date" | "end_date" | "specific_dates" | "weekdays" | "status"
>

/** Janelas de disponibilidade que cruzam um intervalo (para sugerir pregadores na escala). */
export async function listAvailabilityWindows(start: string, end: string) {
  return query<AvailabilityWindow[]>([], async (supabase) => {
    const res = await supabase
      .from("availabilities")
      .select("preacher_id, availability_month, start_date, end_date, specific_dates, weekdays, status")
      .lte("start_date", end)
      .gte("end_date", start)
      .in("status", ["informada", "aguardando_confirmacao"])
    return unwrap(res, [])
  })
}
