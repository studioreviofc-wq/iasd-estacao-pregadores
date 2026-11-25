"use client"

import {
  Archive,
  ArchiveRestore,
  ArrowDownAZ,
  CalendarCheck2,
  CalendarClock,
  FileSpreadsheet,
  Hourglass,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { deletePreacher, setPreacherActive, setPreacherArchived } from "@/app/(app)/pregadores/actions"
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
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { ActionState } from "@/lib/actions/state"
import { formatDate } from "@/lib/domain/dates"
import { preacherCategoryLabel, servicePeriodLabel } from "@/lib/domain/labels"
import { formatBrPhone, normalizeName } from "@/lib/domain/phone"
import { preacherDisplayName } from "@/lib/domain/preacher-name"
import { availabilityLabel, daysSince, timeSince } from "@/lib/domain/preacher-stats"
import type { PreacherOverviewRow } from "@/types/database"

import { PreacherForm } from "./preacher-form"

type Dialog =
  | { type: "form"; preacher?: PreacherOverviewRow }
  | { type: "archive"; preacher: PreacherOverviewRow }
  | { type: "delete"; preacher: PreacherOverviewRow }
  | null

type StatusFilter = "ativos" | "inativos" | "arquivados" | "todos"
type LastFilter = "todos" | "nunca" | "recente" | "3m" | "6m"
type Sort = "alfabetica" | "sem-pregar"

const statusOptions = [
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "arquivados", label: "Arquivados" },
  { value: "todos", label: "Todos (exceto arquivados)" },
]
const lastOptions = [
  { value: "todos", label: "Qualquer última pregação" },
  { value: "nunca", label: "Nunca pregou" },
  { value: "recente", label: "Pregou nos últimos 3 meses" },
  { value: "3m", label: "Sem pregar há mais de 3 meses" },
  { value: "6m", label: "Sem pregar há mais de 6 meses" },
]
const sortOptions = [
  { value: "alfabetica", label: "Ordem alfabética" },
  { value: "sem-pregar", label: "Mais tempo sem pregar" },
]

function digits(v: string) {
  return v.replace(/\D/g, "")
}

export function PreachersView({
  preachers,
  canEdit,
  today,
  whatsapp,
}: {
  preachers: PreacherOverviewRow[]
  canEdit: boolean
  today: string
  whatsapp: WhatsappContext
}) {
  const autoOpen = useAutoOpen()
  const [dialog, setDialogState] = useState<Dialog>(() => (canEdit && autoOpen.requested ? { type: "form" } : null))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("ativos")
  const [last, setLast] = useState<LastFilter>("todos")
  const [sort, setSort] = useState<Sort>("alfabetica")

  const setDialog = (next: Dialog) => {
    if (!next) autoOpen.clear()
    setDialogState(next)
  }

  const filtered = useMemo(() => {
    const q = normalizeName(search)
    const qDigits = digits(search)
    const list = preachers.filter((p) => {
      const archived = Boolean(p.archived_at)
      if (status === "arquivados" ? !archived : archived) return false
      if (status === "ativos" && !p.is_active) return false
      if (status === "inativos" && p.is_active) return false

      const days = daysSince(p.last_preached_on, today)
      if (last === "nunca" && p.total_preached > 0) return false
      if (last === "recente" && (days === null || days > 91)) return false
      if (last === "3m" && days !== null && days <= 91) return false
      if (last === "6m" && days !== null && days <= 182) return false

      if (!q && !qDigits) return true
      const byName = q && normalizeName(`${p.full_name} ${p.nickname ?? ""} ${p.home_church ?? ""}`).includes(q)
      const byPhone =
        qDigits.length >= 3 && [p.phone_normalized, digits(p.whatsapp ?? "")].some((n) => n?.includes(qDigits))
      return byName || byPhone
    })

    return list.sort((a, b) => {
      if (sort === "sem-pregar") {
        // Nunca pregou primeiro; depois quem pregou há mais tempo.
        if (!a.last_preached_on && b.last_preached_on) return -1
        if (a.last_preached_on && !b.last_preached_on) return 1
        if (a.last_preached_on && b.last_preached_on && a.last_preached_on !== b.last_preached_on) {
          return a.last_preached_on < b.last_preached_on ? -1 : 1
        }
      }
      return a.full_name.localeCompare(b.full_name, "pt-BR")
    })
  }, [preachers, search, status, last, sort, today])

  const counts = useMemo(
    () => ({
      active: preachers.filter((p) => p.is_active && !p.archived_at).length,
      never: preachers.filter((p) => !p.archived_at && p.total_preached === 0).length,
    }),
    [preachers]
  )

  async function run(action: Promise<ActionState>) {
    const result = await action
    if (result.status === "success") toast.success(result.message)
    else if (result.status === "error") toast.error(result.message)
  }

  const newButton = canEdit ? (
    <Button onClick={() => setDialog({ type: "form" })}>
      <UserPlus data-icon="inline-start" />
      Novo pregador
    </Button>
  ) : null

  function rowActions(p: PreacherOverviewRow) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${p.full_name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/pregadores/${p.id}`}>
              <UserRound /> Ver perfil e histórico
            </Link>
          </DropdownMenuItem>
          {canEdit ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog({ type: "form", preacher: p })}>
                <Pencil /> Editar
              </DropdownMenuItem>
              {!p.archived_at ? (
                <DropdownMenuItem onSelect={() => run(setPreacherActive(p.id, !p.is_active))}>
                  <Power /> {p.is_active ? "Marcar como inativo" : "Reativar"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {p.archived_at ? (
                <DropdownMenuItem onSelect={() => run(setPreacherArchived(p.id, false))}>
                  <ArchiveRestore /> Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog({ type: "archive", preacher: p })}>
                  <Archive /> Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ type: "delete", preacher: p })}>
                <Trash2 /> Excluir cadastro
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function statusBadge(p: PreacherOverviewRow) {
    if (p.archived_at) return <StatusBadge tone="neutral" label="Arquivado" />
    return <StatusBadge tone={p.is_active ? "success" : "warning"} label={p.is_active ? "Ativo" : "Inativo"} />
  }

  function lastPreached(p: PreacherOverviewRow) {
    if (!p.last_preached_on) return <StatusBadge tone="brand" label="Nunca pregou" />
    return (
      <span>
        <span className="font-medium tabular-nums">{formatDate(p.last_preached_on, "dd/MM/yyyy")}</span>
        <span className="block text-xs text-muted-foreground">{timeSince(p.last_preached_on, today)}</span>
      </span>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, apelido, igreja ou telefone"
              className="h-9 bg-card pl-8"
              aria-label="Buscar pregadores por nome ou telefone"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild variant="outline">
                <a href="/exportar/pregadores" download>
                  <FileSpreadsheet data-icon="inline-start" />
                  Exportar CSV
                </a>
              </Button>
            ) : null}
            {newButton}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
          <div className="lg:w-52">
            <SelectField name="filtro-status" options={statusOptions} value={status} onValueChange={(v) => setStatus(v as StatusFilter)} />
          </div>
          <div className="lg:w-64">
            <SelectField name="filtro-ultima" options={lastOptions} value={last} onValueChange={(v) => setLast(v as LastFilter)} />
          </div>
          <div className="lg:w-56">
            <SelectField name="ordenacao" options={sortOptions} value={sort} onValueChange={(v) => setSort(v as Sort)} />
          </div>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {counts.active} ativos
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="size-3.5" /> {counts.never} nunca pregaram
          </span>
          <span className="flex items-center gap-1">
            {sort === "alfabetica" ? <ArrowDownAZ className="size-3.5" /> : <Hourglass className="size-3.5" />}
            {sort === "alfabetica" ? "Ordem alfabética" : "Quem está há mais tempo sem pregar primeiro"}
          </span>
        </p>
      </div>

      {preachers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum pregador cadastrado"
          description="Cadastre os pregadores com nome, apelido e igreja — o telefone pode vir depois."
          className="bg-card"
          action={newButton}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste a busca ou os filtros." className="bg-card" compact />
      ) : (
        <>
          <div className="hidden lg:block">
            <TableCard footer={`${filtered.length} de ${preachers.length} pregadores`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pregador</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Última pregação</TableHead>
                    <TableHead>Próxima confirmada</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Disponibilidade</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className={p.is_active ? undefined : "opacity-70"}>
                      <TableCell>
                        <Link href={`/pregadores/${p.id}`} className="font-medium hover:text-primary hover:underline">
                          {preacherDisplayName(p)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {p.role_title ?? preacherCategoryLabel[p.category]}
                          {p.home_church ? ` · ${p.home_church}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={p.phone ? "tabular-nums" : "text-muted-foreground"}>
                            {p.phone ? formatBrPhone(p.phone) : "Sem telefone"}
                          </span>
                          <WhatsappButton preacher={p} context={whatsapp} />
                        </div>
                      </TableCell>
                      <TableCell>{lastPreached(p)}</TableCell>
                      <TableCell>
                        {p.next_confirmed_on ? (
                          <span className="flex items-center gap-1.5 text-brand-600">
                            <CalendarCheck2 className="size-3.5" />
                            <span className="tabular-nums">
                              {formatDate(p.next_confirmed_on, "dd/MM")}
                              {p.next_confirmed_period ? ` · ${servicePeriodLabel[p.next_confirmed_period]}` : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{p.total_preached}</TableCell>
                      <TableCell>
                        {availabilityLabel(p.next_available_start, p.next_available_end) ? (
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="size-3.5 text-muted-foreground" />
                            {availabilityLabel(p.next_available_start, p.next_available_end)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(p)}</TableCell>
                      <TableCell className="text-right">{rowActions(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </div>

          <ul className="space-y-2 lg:hidden">
            {filtered.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/pregadores/${p.id}`} className="block truncate font-medium hover:text-primary">
                      {preacherDisplayName(p)}
                    </Link>
                    <p className="text-sm text-muted-foreground tabular-nums">{p.phone ? formatBrPhone(p.phone) : "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <WhatsappButton preacher={p} context={whatsapp} />
                    {rowActions(p)}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Última pregação</dt>
                    <dd>{lastPreached(p)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Próxima confirmada</dt>
                    <dd className="tabular-nums">{p.next_confirmed_on ? formatDate(p.next_confirmed_on, "dd/MM") : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Pregações realizadas</dt>
                    <dd className="font-medium tabular-nums">{p.total_preached}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Disponibilidade</dt>
                    <dd>{availabilityLabel(p.next_available_start, p.next_available_end) ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-3">{statusBadge(p)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <FormDialog
        open={dialog?.type === "form"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.type === "form" && dialog.preacher ? "Editar pregador" : "Novo pregador"}
        description="Só o nome é obrigatório. Apelido, igreja e telefone ajudam na organização."
      >
        {dialog?.type === "form" ? <PreacherForm preacher={dialog.preacher} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      {dialog?.type === "archive" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Arquivar ${dialog.preacher.full_name}?`}
          description="O pregador sai das listas e da escala, mas todo o histórico (pregações, convites e disponibilidades) é preservado. É possível restaurar depois."
          confirmLabel="Arquivar"
          onConfirm={() => setPreacherArchived(dialog.preacher.id, true)}
        />
      ) : null}

      {dialog?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Excluir o cadastro de ${dialog.preacher.full_name}?`}
          description="Só é possível excluir cadastros sem nenhum histórico (cultos, convites ou disponibilidades). Se houver histórico, use “Arquivar”. Esta ação não pode ser desfeita."
          onConfirm={() => deletePreacher(dialog.preacher.id)}
        />
      ) : null}
    </>
  )
}
