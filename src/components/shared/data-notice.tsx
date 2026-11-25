import { AlertTriangle, DatabaseZap } from "lucide-react"
import Link from "next/link"

import type { DataResult } from "@/lib/data/result"

/** Aviso exibido quando o banco não está conectado ou a consulta falhou. */
export function DataNotice({ result }: { result: DataResult<unknown> }) {
  if (result.status === "ok") return null

  if (result.status === "unconfigured") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <DatabaseZap className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Banco de dados ainda não conectado</p>
          <p className="text-muted-foreground">
            As informações aparecerão aqui assim que o Supabase for configurado. Nenhum dado de exemplo é exibido.{" "}
            <Link href="/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
              Ver instruções
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Não foi possível carregar os dados</p>
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    </div>
  )
}
