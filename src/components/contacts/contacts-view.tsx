"use client"

import { History, MessageSquarePlus, MoreHorizontal, PhoneCall, Reply, Search, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { deleteContact } from "@/app/(app)/contatos/actions"
import type { MonthOption } from "@/components/availability/availability-fields"
import { ConfirmDialog } from "@/components/forms/confirm-dialog"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/form-kit"
import { useAutoOpen } from "@/components/forms/use-auto-open"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableCard } from "@/components/shared/table-card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { PreacherOption } from "@/lib/data/preachers"
import type { ServiceOption } from "@/lib/data/services"
import type { ContactLogWithRelations } from "@/lib/data/types"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { contactChannelLabel, contactOutcomeMeta, servicePeriodLabel } from "@/lib/domain/labels"
import { normalizeName } from "@/lib/domain/phone"
import { contactOutcomes } from "@/lib/validation/contact"
import { cn } from "@/lib/utils"
import type { ContactLatestRow, ContactLogRow } from "@/types/database"

import { ContactForm, type ContactFormPrefill } from "./contact-form"

type Dialog = { type: "form"; prefill?: ContactFormPrefill } | { type: "delete"; item: ContactLogWithRelations } | null
type View = "atual" | "historico"

const statusFilterOptions = [
  { value: "todos", label: "Todas as respostas" },
  { value: "pendentes", label: "Pendências (aguardando ou retomar)" },
  ...contactOutcomes.map((o) => ({ value: o, label: contactOutcomeMeta[o].label })),
]

function invitedFor(c: Pick<ContactLogRow, "invited_for_month">, service?: ContactLogWithRelations["service"]) {
  if (service) return `${formatDate(service.service_date, "dd/MM/yyyy")} · ${servicePeriodLabel[service.period]}`
  if (c.invited_for_month) return capitalize(formatDate(c.invited_for_month, "MMMM 'de' yyyy"))
  return "—"
}

function FollowUp({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const overdue = date < today
  const isToday = date === today
  return (
    <span className={cn("tabular-nums", overdue && "font-medium text-destructive", isToday && "font-medium text-warning")}>
      {formatDate(date, "dd/MM/yyyy")}
      {isToday ? " · hoje" : overdue ? " · atrasado" : ""}
    </span>
  )
}

function needsAction(c: Pick<ContactLogRow, "outcome" | "follow_up_on">, today: string) {
  if (c.outcome === "aguardando" || c.outcome === "novo_contato" || c.outcome === "nao_contatado") return true
  return Boolean(c.follow_up_on && c.follow_up_on <= today && c.outcome !== "aceito" && c.outcome !== "indisponivel")
}

export function ContactsView({
  logs,
  latest,
  preachers,
  services,
  monthOptions,
  today,
  canEdit,
  whatsapp,
}: {
  logs: ContactLogWithRelations[]
  latest: ContactLatestRow[]
  preachers: PreacherOption[]
  services: ServiceOption[]
  monthOptions: MonthOption[]
  today: string
  canEdit: boolean
  whatsapp: WhatsappContext
}) {
  const autoOpen = useAutoOpen()
  const [dialog, setDialogState] = useState<Dialog>(() => (canEdit && autoOpen.requested ? { type: "form" } : null))
  const [view, setView] = useState<View>("atual")
  const [status, setStatus] = useState("todos")
  const [search, setSearch] = useState("")

  const setDialog = (next: Dialog) => {
    if (!next) autoOpen.clear()
    setDialogState(next)
  }

  const servicesById = useMemo(() => new Map(logs.flatMap((l) => (l.service ? [[l.service.id, l.service] as const] : []))), [logs])

  function matches(c: { outcome: ContactLogRow["outcome"]; follow_up_on: string | null }, name: string) {
    if (search && !normalizeName(name).includes(normalizeName(search))) return false
    if (status === "pendentes") return needsAction(c, today)
    return status === "todos" || c.outcome === status
  }

  const latestFiltered = latest.filter((c) => matches(c, c.preacher_name))
  const logsFiltered = logs.filter((c) => matches(c, c.preacher?.full_name ?? ""))
  const pendingCount = latest.filter((c) => needsAction(c, today)).length

  function newInteraction(c: ContactLatestRow | ContactLogWithRelations) {
    setDialog({
      type: "form",
      prefill: {
        preacherId: c.preacher_id,
        previous: { id: c.id, invited_for_month: c.invited_for_month, service_id: c.service_id, channel: c.channel },
      },
    })
  }

  const newButton = canEdit ? (
    <Button onClick={() => setDialog({ type: "form" })}>
      <MessageSquarePlus data-icon="inline-start" />
      Registrar contato
    </Button>
  ) : null

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="atual">
                <UserRound /> Situação atual
                {pendingCount ? <span className="ml-1 rounded-full bg-warning/15 px-1.5 text-xs text-warning">{pendingCount}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History /> Histórico completo
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pregador" className="h-9 bg-card pl-8" />
          </div>
          <div className="sm:w-64">
            <SelectField name="filtro-status" options={statusFilterOptions} value={status} onValueChange={setStatus} />
          </div>
        </div>
        {newButton}
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="Nenhum contato registrado"
          description="Registre cada tentativa de contato, a resposta recebida e, se for o caso, os meses em que o pregador estará disponível."
          className="bg-card"
          action={newButton}
        />
      ) : view === "atual" ? (
        latestFiltered.length === 0 ? (
          <EmptyState compact icon={Search} title="Nada neste filtro" className="bg-card" />
        ) : (
          <TableCard footer={`${latestFiltered.length} ${latestFiltered.length === 1 ? "pregador" : "pregadores"} · último contato de cada um`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pregador</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead>Convidado para</TableHead>
                  <TableHead>Novo contato</TableHead>
                  <TableHead className="w-28">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestFiltered.map((c) => {
                  const meta = contactOutcomeMeta[c.outcome]
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/pregadores/${c.preacher_id}`} className="font-medium hover:text-primary hover:underline">
                          {c.preacher_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground tabular-nums">{c.preacher_phone ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(c.contacted_at.slice(0, 10), "dd/MM/yyyy")}
                        <span className="block text-xs text-muted-foreground">{contactChannelLabel[c.channel]}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invitedFor(c, c.service_id ? servicesById.get(c.service_id) : null)}
                      </TableCell>
                      <TableCell>
                        <FollowUp date={c.follow_up_on} today={today} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <WhatsappButton
                            preacher={{ full_name: c.preacher_name, phone: c.preacher_phone, whatsapp: c.preacher_whatsapp }}
                            context={whatsapp}
                          />
                          {canEdit ? (
                            <Button variant="outline" size="sm" onClick={() => newInteraction(c)}>
                              <Reply data-icon="inline-start" />
                              Nova interação
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableCard>
        )
      ) : logsFiltered.length === 0 ? (
        <EmptyState compact icon={Search} title="Nada neste filtro" className="bg-card" />
      ) : (
        <TableCard footer={`${logsFiltered.length} registros · os contatos nunca são sobrescritos`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pregador</TableHead>
                <TableHead>Meio</TableHead>
                <TableHead>Convidado para</TableHead>
                <TableHead>Resposta</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Novo contato</TableHead>
                {canEdit ? (
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsFiltered.map((c) => {
                const meta = contactOutcomeMeta[c.outcome]
                return (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums">{formatDate(c.contacted_at.slice(0, 10), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">
                      {c.preacher ? (
                        <Link href={`/pregadores/${c.preacher.id}`} className="hover:text-primary hover:underline">
                          {c.preacher.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{contactChannelLabel[c.channel]}</TableCell>
                    <TableCell className="text-muted-foreground">{invitedFor(c, c.service)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={c.notes ?? undefined}>
                      {c.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <FollowUp date={c.follow_up_on} today={today} />
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Ações">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => newInteraction(c)}>
                              <Reply /> Nova interação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ type: "delete", item: c })}>
                              <Trash2 /> Excluir lançamento
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      <FormDialog
        open={dialog?.type === "form"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.type === "form" && dialog.prefill?.previous ? "Nova interação" : "Registrar contato"}
        description="Cada interação é um novo registro — o histórico anterior é preservado."
      >
        {dialog?.type === "form" ? (
          <ContactForm
            prefill={dialog.prefill}
            preachers={preachers}
            services={services}
            monthOptions={monthOptions}
            today={today}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </FormDialog>

      {dialog?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Excluir este lançamento?"
          description="Use apenas para registros feitos por engano. Para uma nova resposta do pregador, registre uma nova interação. O culto vinculado não é alterado."
          onConfirm={() => deleteContact(dialog.item.id)}
        />
      ) : null}
    </>
  )
}
