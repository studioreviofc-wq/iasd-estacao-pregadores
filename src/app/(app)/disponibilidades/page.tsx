import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { AvailabilityView } from "@/components/availability/availability-view"
import { DataNotice } from "@/components/shared/data-notice"
import { TableSkeleton } from "@/components/shared/loading"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { listAvailabilityOverview } from "@/lib/data/availabilities"
import { getMonthOptions } from "@/lib/data/month-options"
import { getWhatsappContext, listPreacherOptions } from "@/lib/data/preachers"
import { listUpcomingServiceOptions } from "@/lib/data/services"
import { getViewer } from "@/lib/data/session"
import { todayISO } from "@/lib/domain/dates"

export const metadata: Metadata = { title: "Disponibilidades" }

async function Availability() {
  await connection()
  const today = todayISO()
  const [result, preachers, services, viewer, whatsapp, monthOptions] = await Promise.all([
    listAvailabilityOverview(),
    listPreacherOptions(),
    listUpcomingServiceOptions(today),
    getViewer(),
    getWhatsappContext(),
    getMonthOptions(),
  ])
  return (
    <>
      <DataNotice result={result} />
      <AvailabilityView
        items={result.data}
        preachers={preachers.data}
        services={services.data}
        monthOptions={monthOptions}
        today={today}
        canEdit={viewer.canEdit}
        whatsapp={whatsapp}
      />
    </>
  )
}

export default function AvailabilityPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Disponibilidades futuras"
        description="Pregadores que sinalizaram disponibilidade, organizados por mês. Disponibilidade não é escala confirmada."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Availability />
      </Suspense>
    </PageContainer>
  )
}
