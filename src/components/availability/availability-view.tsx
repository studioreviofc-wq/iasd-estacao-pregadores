"use client"

import { CalendarClock, CalendarPlus, Link2, MoreHorizontal, Pencil, RotateCcw, Search, Trash2, UserX, Hourglass } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { deleteAvailability, setAvailabilityStatus } from "@/app/(app)/disponibilidades/actions"
import { ConfirmDialog } from "@/components/forms/confirm-dialog"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/form-kit"
import { useAutoOpen } from "@/components/forms/use-auto-open"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { ActionState } from "@/lib/actions/state"
import type { PreacherOption } from "@/lib/data/preachers"
import type { ServiceOption } from "@/lib/data/services"
import { availableDaysLabel } from "@/lib/domain/availability-format"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { availabilityStatusMeta } from "@/lib/domain/labels"
import { formatBrPhone, normalizeName } from "@/lib/domain/phone"
import { timeSince } from "@/lib/domain/preacher-stats"
import type { AvailabilityOverviewRow, AvailabilityStatus } from "@/types/database"

import type { MonthOption } from "./availability-fields"
import { AvailabilityForm } from "./availability-form"
import { LinkServiceDialog } from "./link-service-dialog"

type Dialog = { type: "form"; item?: AvailabilityOverviewRow } | { type: "delete"; item: AvailabilityOverviewRow } | null
type Filter = "vigentes" | "agendado" | "encerradas" | "todas"

const filterOptions = [
  { value: "vigentes", label: "Vigentes (informadas e aguardando)" },
  { value: "agendado", label: "Agendadas" },
  { value: "encerradas", label: "Não disponíveis e expiradas" },
  { value: "todas", label: "Todas" },
]

const OPEN: AvailabilityStatus[] = ["informada", "aguardando_confirmacao"]

function matchesFilter(s: AvailabilityStatus, f: Filter) {
  if (f === "todas") return true
  if (f === "vigentes") return OPEN.includes(s)
  if (f === "agendado") return s === "agendado"
  return s === "indisponivel" || s === "expirada"
}

export function AvailabilityView({
  items,
  preachers,
  services,
  monthOptions,
  today,
  canEdit,
  whatsapp,
}: {
  items: AvailabilityOverviewRow[]
  preachers: PreacherOption[]
  services: ServiceOption[]
  monthOptions: MonthOption[]
  today: string
  canEdit: boolean
  whatsapp: WhatsappContext
}) {
  const autoOpen = useAutoOpen()
  const [dialog, setDialogState] = useState<Dialog>(() => (canEdit && autoOpen.requested ? { type: "form" } : null))
  const [linking, setLinking] = useState<AvailabilityOverviewRow | null>(null)
  const [filter, setFilter] = useState<Filter>("vigentes")
  const [search, setSearch] = useState("")

  const setDialog = (next: Dialog) => {
    if (!next) autoOpen.clear()
    setDialogState(next)
  }

  const groups = useMemo(() => {
    const q = normalizeName(search)
    const map = new Map<string, AvailabilityOverviewRow[]>()
    for (const a of items) {
      if (!matchesFilter(a.effective_status, filter)) continue
      if (q && !normalizeName(a.preacher_name).includes(q)) continue
      const key = a.availability_month.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items, filter, search])

  async function run(action: Promise<ActionState>) {
    const r = await action
    if (r.status === "success") toast.success(r.message)
    else if (r.status === "error") toast.error(r.message)
  }

  const newButton = canEdit ? (
    <Button onClick={() => setDialog({ type: "form" })}>
      <CalendarPlus data-icon="inline-start" />
      Registrar disponibilidade
    </Button>
  ) : null

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pregador" className="h-9 bg-card pl-8" />
          </div>
          <div className="sm:w-72">
            <SelectField name="filtro" options={filterOptions} value={filter} onValueChange={(v) => setFilter(v as Filter)} />
          </div>
        </div>
        {newButton}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma disponibilidade registrada"
          description="Quando um pregador disser que só pode em outro mês, registre aqui (ou no contato, com a resposta “Disponível em outro mês”)."
          className="bg-card"
          action={newButton}
        />
      ) : groups.length === 0 ? (
        <EmptyState compact icon={Search} title="Nada neste filtro" className="bg-card" />
      ) : (
        <div className="space-y-6">
          {groups.map(([month, rows]) => (
            <section key={month} aria-label={month} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-base font-semibold">
                {capitalize(formatDate(`${month}-01`, "MMMM 'de' yyyy"))}
                <span className="text-sm font-normal text-muted-foreground">
                  {rows.length} {rows.length === 1 ? "pregador" : "pregadores"}
                </span>
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {rows.map((a) => {
                  const meta = availabilityStatusMeta[a.effective_status]
                  const open = OPEN.includes(a.effective_status)
                  return (
                    <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/pregadores/${a.preacher_id}`} className="block truncate font-medium hover:text-primary hover:underline">
                            {a.preacher_name}
                          </Link>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {a.preacher_phone ? formatBrPhone(a.preacher_phone) : "—"}
                          </p>
                        </div>
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </div>

                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Dias disponíveis</dt>
                          <dd className="font-medium">{availableDaysLabel(a)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Última pregação</dt>
                          <dd>
                            {a.last_preached_on ? (
                              <>
                                <span className="tabular-nums">{formatDate(a.last_preached_on, "dd/MM/yyyy")}</span>
                                <span className="block text-xs text-muted-foreground">{timeSince(a.last_preached_on, today)}</span>
                              </>
                            ) : (
                              <StatusBadge tone="brand" label="Nunca pregou" />
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Último contato</dt>
                          <dd className="tabular-nums">{a.last_contacted_at ? formatDate(a.last_contacted_at.slice(0, 10), "dd/MM/yyyy") : "—"}</dd>
                        </div>
                        {a.follow_up_on ? (
                          <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">Novo contato em</dt>
                            <dd className={a.follow_up_on <= today && open ? "font-medium text-warning" : undefined}>
                              {formatDate(a.follow_up_on, "dd/MM/yyyy")}
                            </dd>
                          </div>
                        ) : null}
                        {a.notes ? (
                          <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">Observações</dt>
                            <dd className="text-muted-foreground">{a.notes}</dd>
                          </div>
                        ) : null}
                      </dl>

                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <WhatsappButton
                          variant="full"
                          preacher={{ full_name: a.preacher_name, phone: a.preacher_phone, whatsapp: a.preacher_whatsapp }}
                          context={whatsapp}
                        />
                        {canEdit && open ? (
                          <Button onClick={() => setLinking(a)}>
                            <Link2 data-icon="inline-start" />
                            Vincular a culto
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="ml-auto" aria-label="Mais ações">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setDialog({ type: "form", item: a })}>
                                <Pencil /> Editar
                              </DropdownMenuItem>
                              {a.status !== "aguardando_confirmacao" && a.status !== "agendado" ? (
                                <DropdownMenuItem onSelect={() => run(setAvailabilityStatus(a.id, "aguardando_confirmacao"))}>
                                  <Hourglass /> Aguardando nova confirmação
                                </DropdownMenuItem>
                              ) : null}
                              {a.status !== "indisponivel" && a.status !== "agendado" ? (
                                <DropdownMenuItem onSelect={() => run(setAvailabilityStatus(a.id, "indisponivel"))}>
                                  <UserX /> Não está mais disponível
                                </DropdownMenuItem>
                              ) : null}
                              {a.status === "indisponivel" || a.status === "aguardando_confirmacao" ? (
                                <DropdownMenuItem onSelect={() => run(setAvailabilityStatus(a.id, "informada"))}>
                                  <RotateCcw /> Voltar para informada
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ type: "delete", item: a })}>
                                <Trash2 /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <LinkServiceDialog availability={linking} services={services} onClose={() => setLinking(null)} />

      <FormDialog
        open={dialog?.type === "form"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.type === "form" && dialog.item ? "Editar disponibilidade" : "Registrar disponibilidade"}
        description="Disponibilidade não é confirmação: para escalar, use “Vincular a culto”."
      >
        {dialog?.type === "form" ? (
          <AvailabilityForm availability={dialog.item} preachers={preachers} monthOptions={monthOptions} onDone={() => setDialog(null)} />
        ) : null}
      </FormDialog>

      {dialog?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Excluir esta disponibilidade?"
          description="Use apenas para registros feitos por engano. Se o pregador não puder mais, prefira “Não está mais disponível”, que preserva o histórico."
          onConfirm={() => deleteAvailability(dialog.item.id)}
        />
      ) : null}
    </>
  )
}
