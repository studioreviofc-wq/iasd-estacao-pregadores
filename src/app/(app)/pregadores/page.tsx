import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { PreachersView } from "@/components/preachers/preachers-view"
import { DataNotice } from "@/components/shared/data-notice"
import { TableSkeleton } from "@/components/shared/loading"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { getWhatsappContext, listPreacherOverview } from "@/lib/data/preachers"
import { getViewer } from "@/lib/data/session"
import { todayISO } from "@/lib/domain/dates"

export const metadata: Metadata = { title: "Pregadores" }

async function Preachers() {
  await connection()
  const [result, viewer, whatsapp] = await Promise.all([listPreacherOverview(), getViewer(), getWhatsappContext()])
  return (
    <>
      <DataNotice result={result} />
      <PreachersView preachers={result.data} canEdit={viewer.canEdit} today={todayISO()} whatsapp={whatsapp} />
    </>
  )
}

export default function PreachersPage() {
  return (
    <PageContainer>
      <PageHeader title="Pregadores" description="Cadastro, situação e histórico de quem prega na igreja." />
      <Suspense fallback={<TableSkeleton />}>
        <Preachers />
      </Suspense>
    </PageContainer>
  )
}
