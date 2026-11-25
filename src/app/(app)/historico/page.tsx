import { FileText, History } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { DataNotice } from "@/components/shared/data-notice"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { TableCard } from "@/components/shared/table-card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listPreachingHistory } from "@/lib/data/services"
import { formatDate } from "@/lib/domain/dates"
import { preacherCategoryLabel, serviceTypeLabel } from "@/lib/domain/labels"

export const metadata: Metadata = { title: "Histórico" }

async function HistoryTable() {
  const result = await listPreachingHistory()
  const items = result.data

  return (
    <>
      <DataNotice result={result} />
      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma pregação no histórico"
          description="Cultos marcados como realizados passam a compor o histórico automaticamente."
          className="bg-card"
        />
      ) : (
        <TableCard footer={`Últimas ${items.length} pregações`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pregador</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead>Texto bíblico</TableHead>
                <TableHead>Culto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="tabular-nums">{formatDate(h.service_date, "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <span className="font-medium">{h.preacher_name}</span>
                    <span className="block text-xs text-muted-foreground">{preacherCategoryLabel[h.preacher_category]}</span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{h.sermon_title ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{h.bible_reference ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{h.title ?? serviceTypeLabel[h.service_type]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </>
  )
}

export default function HistoryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Histórico de pregações"
        description="Registro das pregações já realizadas na igreja."
        actions={
          <Button asChild variant="outline">
            <a href="/exportar/historico" download>
              <FileText data-icon="inline-start" />
              Exportar CSV
            </a>
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <HistoryTable />
      </Suspense>
    </PageContainer>
  )
}
