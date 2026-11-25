import { FillIndicator } from "@/components/calendar/fill-indicator"
import { SectionCard } from "@/components/shared/section-card"
import type { DashboardData } from "@/lib/data/dashboard"
import { capitalize, type MonthRef } from "@/lib/domain/dates"

export function ScheduleProgress({ data, month }: { data: DashboardData; month: MonthRef }) {
  const { total } = data.progress
  return (
    <SectionCard
      title="Preenchimento da escala"
      description={`${capitalize(month.label)} · ${total} ${total === 1 ? "culto ativo" : "cultos ativos"}`}
      contentClassName="[&>div]:border-0 [&>div]:p-0 [&>div]:shadow-none"
    >
      <FillIndicator services={data.monthStatuses} />
    </SectionCard>
  )
}
