import "server-only"

import { fromISODate, monthRef, shiftMonth, todayISO, type MonthRef } from "@/lib/domain/dates"

import type { AvailabilityOverviewRow, ContactLatestRow, ServiceStatus } from "@/types/database"

import { query, unwrap, unwrapCount } from "./result"
import type { ServiceWithPreacher } from "./types"

const PREACHER_JOIN = "preacher:preachers(id, full_name, category)"

export type DashboardStats = {
  totalServices: number
  confirmed: number
  open: number
  awaiting: number
  futureAvailabilities: number
  totalPreachers: number
}

export type DashboardData = {
  stats: DashboardStats
  progress: { filled: number; total: number; percent: number }
  /** Status de cada culto do mês (para o indicador de preenchimento). */
  monthStatuses: { status: ServiceStatus }[]
  upcoming: ServiceWithPreacher[]
  pending: ServiceWithPreacher[]
  availableNextMonth: AvailabilityOverviewRow[]
  nextMonth: MonthRef
  /** Pendências de contato (situação atual de cada pregador). */
  contacts: {
    awaiting: ContactLatestRow[]
    resume: ContactLatestRow[]
    today: { contacts: ContactLatestRow[]; availabilities: AvailabilityOverviewRow[] }
  }
}

function emptyDashboard(month: MonthRef): DashboardData {
  return {
    stats: { totalServices: 0, confirmed: 0, open: 0, awaiting: 0, futureAvailabilities: 0, totalPreachers: 0 },
    progress: { filled: 0, total: 0, percent: 0 },
    monthStatuses: [],
    upcoming: [],
    pending: [],
    availableNextMonth: [],
    nextMonth: shiftMonth(month, 1),
    contacts: { awaiting: [], resume: [], today: { contacts: [], availabilities: [] } },
  }
}

export async function getDashboard(month: MonthRef) {
  return query(emptyDashboard(month), async (supabase) => {
    const today = todayISO()
    // "Próximo mês" é relativo a hoje, não ao mês selecionado.
    const nextMonth = shiftMonth(monthRef(fromISODate(today)), 1)

    const [monthServices, upcoming, pending, futureAvail, availableNext, preachers, latest, avFollowUps] = await Promise.all([
      supabase
        .from("services")
        .select("id, status")
        .gte("service_date", month.start)
        .lte("service_date", month.end),
      supabase
        .from("services")
        .select(`*, ${PREACHER_JOIN}`)
        .gte("service_date", today)
        .in("status", ["confirmado", "convidado"])
        .order("service_date")
        .limit(6),
      supabase
        .from("services")
        .select(`*, ${PREACHER_JOIN}`)
        .gte("service_date", today)
        .in("status", ["aberto", "convidado"])
        .order("service_date")
        .limit(6),
      supabase
        .from("availabilities")
        .select("id", { count: "exact", head: true })
        .gte("end_date", today)
        .in("status", ["informada", "aguardando_confirmacao"]),
      supabase
        .from("availability_overview")
        .select("*")
        .lte("start_date", nextMonth.end)
        .gte("end_date", nextMonth.start)
        .in("effective_status", ["informada", "aguardando_confirmacao"])
        .is("preacher_archived_at", null)
        .order("preacher_name")
        .limit(12),
      supabase.from("preachers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("contact_latest").select("*").order("contacted_at", { ascending: false }),
      supabase
        .from("availability_overview")
        .select("*")
        .eq("follow_up_on", today)
        .in("effective_status", ["informada", "aguardando_confirmacao"])
        .is("preacher_archived_at", null),
    ])

    const latestContacts = unwrap(latest, [])
    const closed = (c: ContactLatestRow) => c.outcome === "aceito" || c.outcome === "indisponivel"

    const allServices = unwrap(monthServices, [])
    const services = allServices.filter((s) => s.status !== "cancelado")
    const total = services.length
    const confirmed = services.filter((s) => s.status === "confirmado" || s.status === "realizado").length
    const open = services.filter((s) => s.status === "aberto").length
    const awaiting = services.filter((s) => s.status === "convidado").length

    return {
      stats: {
        totalServices: total,
        confirmed,
        open,
        awaiting,
        futureAvailabilities: unwrapCount(futureAvail),
        totalPreachers: unwrapCount(preachers),
      },
      progress: { filled: confirmed, total, percent: total ? Math.round((confirmed / total) * 100) : 0 },
      monthStatuses: allServices.map((s) => ({ status: s.status })),
      upcoming: unwrap(upcoming, []) as ServiceWithPreacher[],
      pending: unwrap(pending, []) as ServiceWithPreacher[],
      availableNextMonth: unwrap(availableNext, []),
      nextMonth,
      contacts: {
        awaiting: latestContacts.filter((c) => c.outcome === "aguardando"),
        resume: latestContacts.filter(
          (c) =>
            c.outcome === "novo_contato" ||
            c.outcome === "nao_contatado" ||
            (!closed(c) && c.follow_up_on !== null && c.follow_up_on < today)
        ),
        today: {
          contacts: latestContacts.filter((c) => c.follow_up_on === today && !closed(c)),
          availabilities: unwrap(avFollowUps, []),
        },
      },
    }
  })
}
