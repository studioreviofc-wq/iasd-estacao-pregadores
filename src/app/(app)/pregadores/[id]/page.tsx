import { ArrowLeft, CalendarCheck2, CalendarClock, Hash, Mic, UserX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { z } from "zod"

import { ServiceList } from "@/components/dashboard/service-list"
import { PreacherTimeline } from "@/components/preachers/preacher-timeline"
import { ProfileActions } from "@/components/preachers/profile-actions"
import { DataNotice } from "@/components/shared/data-notice"
import { EmptyState } from "@/components/shared/empty-state"
import { PageContainer } from "@/components/shared/page-container"
import { SectionCard } from "@/components/shared/section-card"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getPreacherProfile, getWhatsappContext } from "@/lib/data/preachers"
import { getViewer } from "@/lib/data/session"
import { availableDaysLabel } from "@/lib/domain/availability-format"
import { capitalize, formatDate, todayISO } from "@/lib/domain/dates"
import { availabilityStatusMeta, preacherCategoryLabel } from "@/lib/domain/labels"
import { formatBrPhone } from "@/lib/domain/phone"
import { preacherDisplayName } from "@/lib/domain/preacher-name"
import { availabilityLabel, timeSince } from "@/lib/domain/preacher-stats"
import { buildTimeline } from "@/lib/domain/timeline"
import { weekdaysLabel } from "@/lib/domain/weekdays"

export const metadata: Metadata = { title: "Perfil do pregador" }

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

function NotFoundState() {
  return (
    <EmptyState
      icon={UserX}
      title="Pregador não encontrado"
      description="O endereço está incorreto ou o cadastro foi excluído."
      className="bg-card"
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/pregadores">Ver todos os pregadores</Link>
        </Button>
      }
    />
  )
}

async function Profile({ params }: { params: PageProps<"/pregadores/[id]">["params"] }) {
  const { id } = await params
  await connection()
  if (!z.uuid().safeParse(id).success) return <NotFoundState />

  const [result, viewer, whatsapp] = await Promise.all([getPreacherProfile(id), getViewer(), getWhatsappContext()])
  if (result.status !== "ok") return <DataNotice result={result} />
  const profile = result.data
  if (!profile) return <NotFoundState />

  const { preacher: p } = profile
  const today = todayISO()
  const upcoming = profile.services
    .filter((s) => s.service_date >= today && (s.status === "confirmado" || s.status === "convidado"))
    .sort((a, b) => a.service_date.localeCompare(b.service_date))
    .map((s) => ({ ...s, preacher: { id: p.id, full_name: p.full_name, category: p.category } }))
  const futureAvailability = profile.availabilities
    .filter((a) => a.end_date >= today && a.status !== "indisponivel")
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const timeline = buildTimeline(profile)

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{preacherDisplayName(p)}</h1>
            {p.archived_at ? (
              <StatusBadge tone="neutral" label="Arquivado" />
            ) : (
              <StatusBadge tone={p.is_active ? "success" : "warning"} label={p.is_active ? "Ativo" : "Inativo"} />
            )}
            {p.total_preached === 0 ? <StatusBadge tone="brand" label="Nunca pregou" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[p.role_title, preacherCategoryLabel[p.category], p.home_church].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProfileActions preacher={p} canEdit={viewer.canEdit} whatsapp={whatsapp} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Resumo">
        <StatCard label="Pregações realizadas" value={p.total_preached} icon={Hash} tone="success" />
        <StatCard
          label="Última pregação"
          value={p.last_preached_on ? formatDate(p.last_preached_on, "dd/MM/yy") : "—"}
          icon={Mic}
          tone="neutral"
          hint={p.last_preached_on ? timeSince(p.last_preached_on, today) : "Nunca pregou"}
        />
        <StatCard
          label="Próxima confirmada"
          value={p.next_confirmed_on ? formatDate(p.next_confirmed_on, "dd/MM/yy") : "—"}
          icon={CalendarCheck2}
          tone="brand"
        />
        <StatCard
          label="Disponibilidade"
          value={availabilityLabel(p.next_available_start, p.next_available_end) ?? "—"}
          icon={CalendarClock}
          tone="warning"
          hint="Próximo período informado"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <SectionCard title="Dados do pregador">
            <dl className="divide-y divide-border">
              <Info label="Apelido" value={p.nickname} />
              <Info label="Telefone" value={p.phone ? formatBrPhone(p.phone) : null} />
              {p.whatsapp ? <Info label="WhatsApp" value={formatBrPhone(p.whatsapp)} /> : null}
              <Info label="E-mail" value={p.email} />
              <Info label="Igreja de origem" value={p.home_church} />
              <Info label="Função / cargo" value={[preacherCategoryLabel[p.category], p.role_title].filter(Boolean).join(" · ")} />
              <Info label="Dias de preferência" value={weekdaysLabel(p.preferred_weekdays)} />
              <Info label="Cadastrado em" value={formatDate(p.created_at.slice(0, 10), "dd/MM/yyyy")} />
            </dl>
          </SectionCard>
          <SectionCard title="Observações gerais">
            {p.notes ? (
              <p className="text-sm whitespace-pre-line">{p.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma observação.</p>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard title="Próximos cultos" description="Confirmados e aguardando confirmação">
            <ServiceList
              items={upcoming}
              empty={{ icon: CalendarCheck2, title: "Nenhum culto futuro", description: "Vincule este pregador a um culto no calendário." }}
            />
          </SectionCard>

          {futureAvailability.length ? (
            <SectionCard title="Disponibilidades futuras">
              <ul className="flex flex-wrap gap-2">
                {futureAvailability.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-medium">{capitalize(formatDate(a.availability_month, "MMMM 'de' yyyy"))}</span>
                    <span className="text-muted-foreground">{availableDaysLabel(a)}</span>
                    <StatusBadge tone={availabilityStatusMeta[a.status].tone} label={availabilityStatusMeta[a.status].label} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard title="Histórico" description="Linha do tempo de pregações, escala, convites e disponibilidades">
            <PreacherTimeline items={timeline} />
          </SectionCard>
        </div>
      </div>
    </>
  )
}

export default function PreacherProfilePage({ params }: PageProps<"/pregadores/[id]">) {
  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/pregadores">
          <ArrowLeft data-icon="inline-start" />
          Pregadores
        </Link>
      </Button>
      <Suspense
        fallback={
          <>
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </>
        }
      >
        <Profile params={params} />
      </Suspense>
    </PageContainer>
  )
}
