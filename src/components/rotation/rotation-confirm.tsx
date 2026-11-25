"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Alerta de repetição devolvido pelo servidor, com confirmação explícita para seguir. */
export function RotationConfirm({
  rotation,
  onConfirm,
  pending,
}: {
  rotation: { preacher: string; warnings: string[] }
  onConfirm: () => void
  pending?: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4" />
        {rotation.preacher} não atende ao intervalo recomendado
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        {rotation.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">É uma recomendação, não um bloqueio. Confirme apenas se for uma exceção consciente.</p>
      <Button type="button" size="sm" variant="outline" onClick={onConfirm} disabled={pending}>
        Entendo — escalar mesmo assim
      </Button>
    </div>
  )
}
