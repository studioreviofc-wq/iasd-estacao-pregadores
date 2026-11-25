import { CalendarCheck2, CalendarClock, CalendarDays, CircleDashed, Clock, Users } from "lucide-react"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"

import { AvailablePreachers } from "@/components/dashboard/available-preachers"
import { ContactPendencies } from "@/components/dashboard/contact-pendencies"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { ScheduleProgress } from "@/components/dashboard/schedule-progress"
import { ServiceList } from "@/components/dashboard/service-list"
import { DataNotice } from "@/components/shared/data-notice"
import { StatsSkeleton } from "@/components/shared/loading"
import { MonthPicker } from "@/components/shared/month-picker"
import { PageContainer } from "@/components/shared/page-container"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboard } from "@/lib/data/dashboard"
import { getWhatsappContext } from "@/lib/data/preachers"
import { getScheduleRange } from "@/lib/data/settings"
import { capitalize, resolveMonthInRange, todayISO } from "@/lib/domain/dates"

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { mes } = await searchParams
  await connection() // "hoje" e o mês corrente são calculados por requisição
  const range = await getScheduleRange()
  const month = resolveMonthInRange(mes, range)
  const [result, whatsapp] = await Promise.all([getDashboard(month), getWhatsappContext()])
  const data = result.data
  const { stats } = data

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Acompanhe a escala de pregações de ${month.label}.`}
        actions={<MonthPicker monthKey={month.key} range={range} />}
      />

      <DataNotice result={result} />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Cultos no mês" value={stats.totalServices} icon={CalendarDays} hint="Exceto cancelados" />
        <StatCard label="Pregadores confirmados" value={stats.confirmed} icon={CalendarCheck2} tone="brand" hint="Confirmados e realizados" />
        <StatCard label="Vagas em aberto" value={stats.open} icon={CircleDashed} tone="neutral" hint="Cultos sem pregador" />
        <StatCard label="Aguardando resposta" value={stats.awaiting} icon={Clock} tone="warning" hint="Convites enviados" />
        <StatCard
          label="Disponibilidades futuras"
          value={stats.futureAvailabilities}
          icon={CalendarClock}
          hint="Registradas a partir de hoje"
        />
        <StatCard label="Pregadores cadastrados" value={stats.totalPreachers} icon={Users} tone="success" hint="Ativos" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ScheduleProgress data={data} month={month} />

          <SectionCard
            title="Próximas pregações"
            description="Confirmadas e aguardando resposta"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/calendario">Ver calendário</Link>
              </Button>
            }
          >
            <ServiceList
              items={data.upcoming}
              empty={{
                icon: CalendarDays,
                title: "Nenhuma pregação agendada",
                description: "Os próximos cultos com pregador definido aparecerão aqui.",
              }}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <QuickActions />

          <SectionCard title="Pendências de contato" description="Respostas, retomadas e retornos de hoje">
            <ContactPendencies data={data.contacts} today={todayISO()} whatsapp={whatsapp} />
          </SectionCard>

          <SectionCard title="Pendências de confirmação" description="Vagas e convites dos próximos cultos">
            <ServiceList
              items={data.pending}
              empty={{ icon: CalendarCheck2, title: "Nenhuma pendência", description: "Todos os próximos cultos estão resolvidos." }}
            />
          </SectionCard>

          <SectionCard
            title="Disponíveis no próximo mês"
            description={`${capitalize(data.nextMonth.label)} · disponibilidade não é escala confirmada`}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/disponibilidades">Ver todas</Link>
              </Button>
            }
          >
            <AvailablePreachers items={data.availableNextMonth} />
          </SectionCard>
        </div>
      </div>
    </>
  )
}

function DashboardFallback() {
  return (
    <>
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>
      <StatsSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </>
  )
}

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardFallback />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
