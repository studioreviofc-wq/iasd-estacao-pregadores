"use client"

import { BellRing, Clock, PhoneCall, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { DashboardData } from "@/lib/data/dashboard"
import { capitalize, formatDate } from "@/lib/domain/dates"
import { contactChannelLabel, contactOutcomeMeta, type Tone } from "@/lib/domain/labels"

type Tab = "aguardando" | "retomar" | "hoje"

type Row = {
  key: string
  preacherId: string
  name: string
  phone: string | null
  whatsapp: string | null
  detail: string
  badge?: { label: string; tone: Tone }
}

/** Pendências de contato: aguardando resposta, retomar e retornos de hoje. */
export function ContactPendencies({
  data,
  today,
  whatsapp,
}: {
  data: DashboardData["contacts"]
  today: string
  whatsapp: WhatsappContext
}) {
  const [tab, setTab] = useState<Tab>("aguardando")

  const awaiting: Row[] = data.awaiting.map((c) => ({
    key: c.id,
    preacherId: c.preacher_id,
    name: c.preacher_name,
    phone: c.preacher_phone,
    whatsapp: c.preacher_whatsapp,
    detail: `${contactChannelLabel[c.channel]} em ${formatDate(c.contacted_at.slice(0, 10), "dd/MM")}${
      c.invited_for_month ? ` · convite para ${formatDate(c.invited_for_month, "MMMM")}` : ""
    }`,
  }))

  const resume: Row[] = data.resume.map((c): Row => ({
    key: c.id,
    preacherId: c.preacher_id,
    name: c.preacher_name,
    phone: c.preacher_phone,
    whatsapp: c.preacher_whatsapp,
    detail: c.follow_up_on && c.follow_up_on < today ? `Retorno previsto em ${formatDate(c.follow_up_on, "dd/MM")}` : `Último contato em ${formatDate(c.contacted_at.slice(0, 10), "dd/MM")}`,
    badge:
      c.follow_up_on && c.follow_up_on < today
        ? { label: "Atrasado", tone: "danger" }
        : { label: contactOutcomeMeta[c.outcome].label, tone: contactOutcomeMeta[c.outcome].tone },
  }))

  const todayRows: Row[] = [
    ...data.today.contacts.map((c) => ({
      key: `c-${c.id}`,
      preacherId: c.preacher_id,
      name: c.preacher_name,
      phone: c.preacher_phone,
      whatsapp: c.preacher_whatsapp,
      detail: `Retorno de contato · ${contactOutcomeMeta[c.outcome].label.toLowerCase()}`,
    })),
    ...data.today.availabilities.map((a) => ({
      key: `a-${a.id}`,
      preacherId: a.preacher_id,
      name: a.preacher_name,
      phone: a.preacher_phone,
      whatsapp: a.preacher_whatsapp,
      detail: `Confirmar disponibilidade de ${capitalize(formatDate(a.availability_month, "MMMM"))}`,
    })),
  ]

  const rows = tab === "aguardando" ? awaiting : tab === "retomar" ? resume : todayRows
  const empty = {
    aguardando: { icon: Clock, title: "Ninguém aguardando resposta" },
    retomar: { icon: RotateCcw, title: "Nenhum contato para retomar" },
    hoje: { icon: BellRing, title: "Nenhum retorno programado para hoje" },
  }[tab]

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="aguardando">Aguardando {awaiting.length ? `(${awaiting.length})` : ""}</TabsTrigger>
          <TabsTrigger value="retomar">Retomar {resume.length ? `(${resume.length})` : ""}</TabsTrigger>
          <TabsTrigger value="hoje">Hoje {todayRows.length ? `(${todayRows.length})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <EmptyState compact icon={empty.icon} title={empty.title} />
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map((r) => (
            <li key={r.key} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Link href={`/pregadores/${r.preacherId}`} className="block truncate text-sm font-medium hover:text-primary">
                  {r.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{r.detail}</p>
              </div>
              {r.badge ? <StatusBadge tone={r.badge.tone} label={r.badge.label} className="hidden sm:inline-flex" /> : null}
              <WhatsappButton preacher={{ full_name: r.name, phone: r.phone, whatsapp: r.whatsapp }} context={whatsapp} />
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link href="/contatos">
          <PhoneCall data-icon="inline-start" />
          Abrir controle de contatos
        </Link>
      </Button>
    </div>
  )
}
