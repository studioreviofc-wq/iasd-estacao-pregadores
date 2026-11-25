import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { ScheduleView } from "@/components/calendar/schedule-view"
import { DataNotice } from "@/components/shared/data-notice"
import { MonthPicker } from "@/components/shared/month-picker"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { listAvailabilityWindows, listOpenAvailabilityBetween } from "@/lib/data/availabilities"
import { getWhatsappContext, listPreacherOptions } from "@/lib/data/preachers"
import { listServicesForMonth } from "@/lib/data/services"
import { getViewer } from "@/lib/data/session"
import { getScheduleRange } from "@/lib/data/settings"
import { capitalize, resolveMonthInRange, todayISO } from "@/lib/domain/dates"

export const metadata: Metadata = { title: "Calendário" }

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendario">["searchParams"] }) {
  const { mes, visao } = await searchParams
  await connection() // "hoje" e o mês corrente são calculados por requisição
  const range = await getScheduleRange()
  const month = resolveMonthInRange(mes, range)
  const [services, preachers, availability, viewer, monthAvailability, whatsapp] = await Promise.all([
    listServicesForMonth(month),
    listPreacherOptions(),
    listAvailabilityWindows(month.start, month.end),
    getViewer(),
    listOpenAvailabilityBetween(month.start, month.end),
    getWhatsappContext(),
  ])

  return (
    <>
      <PageHeader
        title="Calendário de pregações"
        description={`Escala de ${capitalize(month.label)} · sábados pela manhã, quartas e domingos à noite.`}
        actions={<MonthPicker monthKey={month.key} range={range} />}
      />
      <DataNotice result={services} />
      <ScheduleView
        key={month.key}
        month={{ key: month.key, start: month.start, label: month.label }}
        services={services.data}
        preachers={preachers.data}
        availability={availability.data}
        today={todayISO()}
        canEdit={viewer.canEdit}
        initialView={visao === "lista" ? "lista" : "calendario"}
        monthAvailability={monthAvailability.data}
        whatsapp={whatsapp}
      />
    </>
  )
}

export default function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <PageContainer>
      <Suspense
        fallback={
          <>
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-[560px] w-full rounded-xl" />
          </>
        }
      >
        <Calendar searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
