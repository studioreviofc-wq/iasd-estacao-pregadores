"use client"

import { CalendarPlus, FileDown, LayoutGrid, List, Printer, Sparkles } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { generateMonthServices } from "@/app/(app)/calendario/actions"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/form-kit"
import { useAutoOpen } from "@/components/forms/use-auto-open"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AvailabilityWindow } from "@/lib/data/availabilities"
import type { PreacherOption } from "@/lib/data/preachers"
import type { ServiceWithPreacher } from "@/lib/data/types"
import { serviceStatusMeta } from "@/lib/domain/labels"
import { serviceStatuses } from "@/lib/validation/service"

import type { WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { AvailabilityOverviewRow } from "@/types/database"

import { FillIndicator } from "./fill-indicator"
import { MonthAvailabilityPanel } from "./month-availability-panel"
import { MonthCalendar } from "./month-calendar"
import { ScheduleList } from "./schedule-list"
import { ServiceForm } from "./service-form"

type Dialog = { service?: ServiceWithPreacher; date?: string } | null
export type ScheduleViewMode = "calendario" | "lista"

const statusFilterOptions = [
  { value: "todos", label: "Todos os status" },
  ...serviceStatuses.map((s) => ({ value: s, label: serviceStatusMeta[s].label })),
]

export function ScheduleView({
  month,
  services,
  preachers,
  availability,
  today,
  canEdit,
  initialView,
  monthAvailability,
  whatsapp,
}: {
  month: { key: string; start: string; label: string }
  services: ServiceWithPreacher[]
  preachers: PreacherOption[]
  availability: AvailabilityWindow[]
  today: string
  canEdit: boolean
  initialView: ScheduleViewMode
  monthAvailability: AvailabilityOverviewRow[]
  whatsapp: WhatsappContext
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const autoOpen = useAutoOpen()
  const [dialog, setDialogState] = useState<Dialog>(() => (canEdit && autoOpen.requested ? {} : null))
  const [view, setView] = useState<ScheduleViewMode>(initialView)
  const [status, setStatus] = useState("todos")
  const [preacher, setPreacher] = useState("todos")
  const [generating, startGenerate] = useTransition()

  const setDialog = (next: Dialog) => {
    if (!next) autoOpen.clear()
    setDialogState(next)
  }

  function changeView(next: ScheduleViewMode) {
    setView(next)
    const q = new URLSearchParams(params)
    if (next === "lista") q.set("visao", "lista")
    else q.delete("visao")
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  // Pregadores que aparecem no mês + "sem pregador"
  const preacherFilterOptions = useMemo(() => {
    const inMonth = new Map<string, string>()
    for (const s of services) if (s.preacher) inMonth.set(s.preacher.id, s.preacher.full_name)
    return [
      { value: "todos", label: "Todos os pregadores" },
      { value: "sem", label: "Sem pregador" },
      ...[...inMonth].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ]
  }, [services])

  const filtered = useMemo(
    () =>
      services.filter(
        (s) =>
          (status === "todos" || s.status === status) &&
          (preacher === "todos" || (preacher === "sem" ? !s.preacher_id : s.preacher_id === preacher))
      ),
    [services, status, preacher]
  )
  const isFiltered = status !== "todos" || preacher !== "todos"

  function generate() {
    startGenerate(async () => {
      const result = await generateMonthServices(month.key)
      if (result.status === "success") toast.success(result.message)
      else if (result.status === "error") toast.error(result.message)
    })
  }

  const openEdit = canEdit ? (service: ServiceWithPreacher) => setDialog({ service }) : undefined
  const openCreate = canEdit ? (date?: string) => setDialog({ date }) : undefined
  const pdfUrl = `/calendario/pdf?mes=${month.key}`

  return (
    <>
      <FillIndicator services={services} />

      <MonthAvailabilityPanel
        monthLabel={month.label}
        items={monthAvailability}
        services={services.map((s) => ({
          id: s.id,
          service_date: s.service_date,
          service_type: s.service_type,
          period: s.period,
          title: s.title,
          status: s.status,
          preacher_id: s.preacher_id,
        }))}
        canEdit={canEdit}
        whatsapp={whatsapp}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={view} onValueChange={(v) => changeView(v as ScheduleViewMode)}>
            <TabsList>
              <TabsTrigger value="calendario">
                <LayoutGrid /> Calendário
              </TabsTrigger>
              <TabsTrigger value="lista">
                <List /> Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="sm:w-52">
              <SelectField name="filtro-status" options={statusFilterOptions} value={status} onValueChange={setStatus} />
            </div>
            <div className="sm:w-52">
              <SelectField name="filtro-pregador" options={preacherFilterOptions} value={preacher} onValueChange={setPreacher} />
            </div>
          </div>
          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus("todos")
                setPreacher("todos")
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <Printer data-icon="inline-start" />
              Imprimir
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`${pdfUrl}&download=1`}>
              <FileDown data-icon="inline-start" />
              PDF
            </a>
          </Button>
          {canEdit ? (
            <Button onClick={() => openCreate?.()}>
              <CalendarPlus data-icon="inline-start" />
              Culto extraordinário
            </Button>
          ) : null}
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Nenhum culto neste mês"
          description="Os cultos regulares (sábado manhã, quarta e domingo à noite) são criados automaticamente para o período do calendário."
          className="bg-card"
          action={
            canEdit ? (
              <Button variant="outline" onClick={generate} disabled={generating}>
                <Sparkles data-icon="inline-start" />
                {generating ? "Gerando…" : "Gerar cultos regulares do mês"}
              </Button>
            ) : null
          }
        />
      ) : view === "lista" ? (
        <ScheduleList services={filtered} onSelect={openEdit} emptyMessage="Nenhum culto corresponde aos filtros." />
      ) : (
        <>
          <div className="hidden md:block">
            <MonthCalendar monthStart={month.start} services={filtered} today={today} onSelect={openEdit} onCreate={openCreate} />
          </div>
          <div className="md:hidden">
            <ScheduleList services={filtered} onSelect={openEdit} emptyMessage="Nenhum culto corresponde aos filtros." />
          </div>
        </>
      )}

      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.service ? (dialog.service.service_type === "especial" ? "Culto extraordinário" : "Escala do culto") : "Novo culto extraordinário"}
        description={dialog?.service ? "Vincule o pregador, ajuste o status ou edite as informações." : "Para cultos fora da escala regular."}
      >
        {dialog ? (
          <ServiceForm
            service={dialog.service}
            defaultDate={dialog.date}
            preachers={preachers}
            availability={availability}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </FormDialog>
    </>
  )
}
