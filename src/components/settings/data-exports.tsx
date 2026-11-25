import { DatabaseBackup, FileDown, FileSpreadsheet, FileText } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types/database"

/** Botões de exportação conforme o papel do usuário. */
export function DataExports({ role }: { role: UserRole | null }) {
  const staff = role === "administrador" || role === "secretario"
  const items = [
    { href: "/exportar/pregadores", label: "Cadastro de pregadores", hint: "CSV · Excel", icon: FileSpreadsheet, show: staff },
    { href: "/exportar/historico", label: "Histórico de pregações", hint: "CSV · Excel", icon: FileText, show: Boolean(role) },
    { href: "/calendario", label: "Escala mensal", hint: "PDF · no calendário", icon: FileDown, show: Boolean(role), internal: true },
    { href: "/exportar/backup", label: "Backup completo", hint: "JSON · somente administrador", icon: DatabaseBackup, show: role === "administrador" },
  ].filter((i) => i.show)

  if (!items.length) return <p className="text-sm text-muted-foreground">Sem exportações disponíveis para seu usuário.</p>

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((i) => (
        <Button key={i.href} asChild variant="outline" className="h-auto justify-start py-2.5">
          {i.internal ? (
            <Link href={i.href}>
              <i.icon data-icon="inline-start" />
              <span className="text-left">
                <span className="block">{i.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">{i.hint}</span>
              </span>
            </Link>
          ) : (
            <a href={i.href} download>
              <i.icon data-icon="inline-start" />
              <span className="text-left">
                <span className="block">{i.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">{i.hint}</span>
              </span>
            </a>
          )}
        </Button>
      ))}
    </div>
  )
}
