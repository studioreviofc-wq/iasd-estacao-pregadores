import { CalendarPlus, CalendarClock, ChevronRight, MessageSquarePlus, UserPlus } from "lucide-react"
import Link from "next/link"

import { SectionCard } from "@/components/shared/section-card"

const actions = [
  { label: "Cadastrar pregador", description: "Novo nome na lista", href: "/pregadores?novo=1", icon: UserPlus },
  { label: "Escalar pregadores", description: "Preencher a escala do mês", href: "/calendario", icon: CalendarPlus },
  { label: "Registrar disponibilidade", description: "Datas informadas", href: "/disponibilidades?novo=1", icon: CalendarClock },
  { label: "Registrar contato", description: "Convite ou retorno", href: "/contatos?novo=1", icon: MessageSquarePlus },
]

export function QuickActions() {
  return (
    <SectionCard title="Ações rápidas">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <a.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}
