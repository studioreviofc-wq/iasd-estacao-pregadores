import "server-only"

import type { MonthRef } from "@/lib/domain/dates"
import type { PreachingHistoryRow } from "@/types/database"

import { query, unwrap } from "./result"
import type { ServiceWithPreacher } from "./types"

export async function listServicesForMonth(month: MonthRef) {
  return query<ServiceWithPreacher[]>([], async (supabase) => {
    const res = await supabase
      .from("services")
      .select("*, preacher:preachers(id, full_name, category)")
      .gte("service_date", month.start)
      .lte("service_date", month.end)
      .order("service_date")
      .order("start_time")
    return unwrap(res, []) as ServiceWithPreacher[]
  })
}

export async function listPreachingHistory(limit = 100) {
  return query<PreachingHistoryRow[]>([], async (supabase) => {
    const res = await supabase
      .from("preaching_history")
      .select("*")
      .order("service_date", { ascending: false })
      .limit(limit)
    return unwrap(res, [])
  })
}

export type ServiceOption = {
  id: string
  service_date: string
  service_type: ServiceWithPreacher["service_type"]
  period: ServiceWithPreacher["period"]
  title: string | null
  status: ServiceWithPreacher["status"]
  preacher_id: string | null
}

/** Próximos cultos ainda em aberto/convidado/confirmado (para vincular contatos). */
export async function listUpcomingServiceOptions(fromDate: string, limit = 250) {
  return query<ServiceOption[]>([], async (supabase) => {
    const res = await supabase
      .from("services")
      .select("id, service_date, service_type, period, title, status, preacher_id")
      .gte("service_date", fromDate)
      .in("status", ["aberto", "convidado", "confirmado"])
      .order("service_date")
      .limit(limit)
    return unwrap(res, [])
  })
}
