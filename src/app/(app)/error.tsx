"use client"

import { AlertTriangle, RotateCcw } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

/** Erro inesperado numa página interna: mensagem clara e opção de tentar novamente. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Algo deu errado ao carregar esta página</h1>
        <p className="text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente. Se o problema continuar, avise o administrador
          {error.digest ? ` (código ${error.digest})` : ""}.
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        Tentar novamente
      </Button>
    </div>
  )
}
