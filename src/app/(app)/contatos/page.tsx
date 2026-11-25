import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { ContactsView } from "@/components/contacts/contacts-view"
import { DataNotice } from "@/components/shared/data-notice"
import { TableSkeleton } from "@/components/shared/loading"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { listContactLatest, listContactLogs } from "@/lib/data/contacts"
import { getMonthOptions } from "@/lib/data/month-options"
import { getWhatsappContext, listPreacherOptions } from "@/lib/data/preachers"
import { listUpcomingServiceOptions } from "@/lib/data/services"
import { getViewer } from "@/lib/data/session"
import { todayISO } from "@/lib/domain/dates"

export const metadata: Metadata = { title: "Contatos" }

async function Contacts() {
  await connection()
  const today = todayISO()
  const [logs, latest, preachers, services, viewer, whatsapp, monthOptions] = await Promise.all([
    listContactLogs(),
    listContactLatest(),
    listPreacherOptions(),
    listUpcomingServiceOptions(today),
    getViewer(),
    getWhatsappContext(),
    getMonthOptions(),
  ])
  return (
    <>
      <DataNotice result={logs} />
      <ContactsView
        logs={logs.data}
        latest={latest.data}
        preachers={preachers.data}
        services={services.data.filter((s) => s.status !== "confirmado")}
        monthOptions={monthOptions}
        today={today}
        canEdit={viewer.canEdit}
        whatsapp={whatsapp}
      />
    </>
  )
}

export default function ContactsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Controle de contatos"
        description="Todas as tentativas de contato, respostas e retornos programados — inclusive quem só pode em outro mês."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Contacts />
      </Suspense>
    </PageContainer>
  )
}
