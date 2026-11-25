"use client"

import { Lightbulb, Loader2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { rotationCategoryMeta, type RotationAssessment, type Suggestion } from "@/lib/domain/rotation"

/** Situação de rotatividade do pregador selecionado. */
export function RotationStatus({ assessment }: { assessment: RotationAssessment }) {
  const meta = rotationCategoryMeta[assessment.category]
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {assessment.blocked ? (
          <StatusBadge tone="danger" label="Conflito de escala" />
        ) : (
          <StatusBadge tone={meta.tone} label={meta.label} />
        )}
        <span className="text-muted-foreground">
          {assessment.daysSince === null
            ? "Nenhuma pregação antes desta data"
            : `Última pregação/escala: ${assessment.daysSince} dias antes deste culto`}
        </span>
      </div>
      {assessment.blocked ? <p className="font-medium text-destructive">{assessment.blocked}</p> : null}
      {assessment.warnings.map((w) => (
        <p key={w} className="text-destructive">
          {w}
        </p>
      ))}
      {assessment.notes.map((n) => (
        <p key={n} className="text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  )
}

/** Sugestões ordenadas com o motivo de cada recomendação. Apenas sugere. */
export function RotationSuggestions({
  suggestions,
  loading,
  ready,
  error,
  selectedId,
  onPick,
}: {
  suggestions: Suggestion[]
  loading: boolean
  ready: boolean
  error?: string
  selectedId: string
  onPick: (id: string) => void
}) {
  const top = suggestions.filter((s) => !s.assessment.blocked).slice(0, 5)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="size-4 text-warning" />
        Sugestões para esta data
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!ready ? (
        <p className="text-xs text-muted-foreground">Calculando sugestões…</p>
      ) : top.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum pregador ativo disponível para sugerir.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((s, i) => {
            const meta = rotationCategoryMeta[s.assessment.category]
            return (
              <li key={s.preacherId} className="flex items-start gap-2 rounded-md px-1 py-1">
                <span className="mt-0.5 w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{s.name}</span>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[...s.reasons, ...s.assessment.warnings].join(" · ") || "Sem restrições"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant={selectedId === s.preacherId ? "secondary" : "outline"}
                  onClick={() => onPick(s.preacherId)}
                  disabled={selectedId === s.preacherId}
                >
                  {selectedId === s.preacherId ? "Selecionado" : "Escolher"}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        Ordem: disponibilidade no mês → dia da semana → nunca pregou → mais tempo sem pregar → sem outras escalas no mês. Nada é confirmado automaticamente.
      </p>
    </div>
  )
}
