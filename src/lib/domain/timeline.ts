import type { PreacherProfile } from "@/lib/data/preachers"
import type { ContactOutcome } from "@/types/database"

import { availableDaysLabel } from "./availability-format"
import { formatDate } from "./dates"
import {
  availabilityStatusMeta,
  contactChannelLabel,
  contactOutcomeMeta,
  serviceName,
  servicePeriodLabel,
  type Tone,
} from "./labels"

export type TimelineKind = "pregacao" | "escala" | "convite" | "disponibilidade"

export type TimelineItem = {
  id: string
  kind: TimelineKind
  /** Data usada na ordenação (ISO). */
  at: string
  /** Data exibida (dd/MM/yyyy). */
  dateLabel: string
  title: string
  detail?: string | null
  note?: string | null
  tone: Tone
  badge?: { label: string; tone: Tone }
}

const eventText: Record<string, { title: string; tone: Tone }> = {
  escalado: { title: "Escalado — aguardando confirmação", tone: "warning" },
  confirmado: { title: "Confirmou a pregação", tone: "brand" },
  cancelado: { title: "Culto cancelado", tone: "danger" },
  desvinculado: { title: "Removido da escala", tone: "neutral" },
  reaberto: { title: "Escala reaberta", tone: "neutral" },
}

/**
 * Histórico cronológico (mais recente primeiro) a partir de:
 *  • cultos realizados (fonte oficial das pregações)
 *  • eventos da escala (escalado, confirmado, cancelado, removido)
 *  • contatos/convites e suas respostas
 *  • disponibilidades informadas
 */
export function buildTimeline(profile: PreacherProfile): TimelineItem[] {
  const items: TimelineItem[] = []
  const serviceById = new Map(profile.services.map((s) => [s.id, s]))

  for (const s of profile.services) {
    if (s.status !== "realizado") continue
    items.push({
      id: `s-${s.id}`,
      kind: "pregacao",
      at: `${s.service_date}T23:59:59`,
      dateLabel: formatDate(s.service_date, "dd/MM/yyyy"),
      title: "Pregou",
      detail: [serviceName(s), servicePeriodLabel[s.period], s.sermon_title ? `Tema: ${s.sermon_title}` : null, s.bible_reference]
        .filter(Boolean)
        .join(" · "),
      note: s.notes,
      tone: "success",
    })
  }

  for (const e of profile.events) {
    if (e.event_type === "realizado") continue // já representado pelo culto realizado
    const t = eventText[e.event_type]
    const s = e.service_id ? serviceById.get(e.service_id) : undefined
    items.push({
      id: `e-${e.id}`,
      kind: "escala",
      at: e.occurred_at,
      dateLabel: formatDate(e.occurred_at.slice(0, 10), "dd/MM/yyyy"),
      title: t.title,
      detail: `Culto de ${formatDate(e.service_date, "dd/MM/yyyy")} · ${servicePeriodLabel[e.period]}${s?.title ? ` · ${s.title}` : ""}`,
      tone: t.tone,
    })
  }

  for (const c of profile.contacts) {
    const outcome = contactOutcomeMeta[c.outcome as ContactOutcome]
    items.push({
      id: `c-${c.id}`,
      kind: "convite",
      at: c.contacted_at,
      dateLabel: formatDate(c.contacted_at.slice(0, 10), "dd/MM/yyyy"),
      title: `Contato por ${contactChannelLabel[c.channel]}`,
      detail: c.service
        ? `Convite para o culto de ${formatDate(c.service.service_date, "dd/MM/yyyy")} · ${servicePeriodLabel[c.service.period]}`
        : c.invited_for_month
          ? `Convite para ${formatDate(c.invited_for_month, "MMMM 'de' yyyy")}`
          : "Sem data definida",
      note: c.notes,
      tone: outcome.tone,
      badge: { label: `Resposta: ${outcome.label}`, tone: outcome.tone },
    })
  }

  for (const a of profile.availabilities) {
    items.push({
      id: `a-${a.id}`,
      kind: "disponibilidade",
      at: a.created_at,
      dateLabel: formatDate(a.created_at.slice(0, 10), "dd/MM/yyyy"),
      title: `Informou disponibilidade para ${formatDate(a.availability_month, "MMMM 'de' yyyy")}`,
      detail: availableDaysLabel(a),
      note: a.notes,
      tone: "brand",
    })
  }

  // Mudanças de status da disponibilidade (o registro original nunca é sobrescrito)
  const availabilityById = new Map(profile.availabilities.map((a) => [a.id, a]))
  for (const e of profile.availabilityEvents) {
    if (!e.from_status) continue // criação já aparece acima
    if (e.from_status === e.to_status) continue
    const a = availabilityById.get(e.availability_id)
    const meta = availabilityStatusMeta[e.to_status]
    items.push({
      id: `ae-${e.id}`,
      kind: "disponibilidade",
      at: e.occurred_at,
      dateLabel: formatDate(e.occurred_at.slice(0, 10), "dd/MM/yyyy"),
      title: `Disponibilidade${a ? ` de ${formatDate(a.availability_month, "MMMM")}` : ""}: ${meta.label.toLowerCase()}`,
      detail: `Antes: ${availabilityStatusMeta[e.from_status].label.toLowerCase()}`,
      tone: meta.tone,
    })
  }

  return items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
}
