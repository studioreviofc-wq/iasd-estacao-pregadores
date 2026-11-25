import {
  CalendarDays,
  CalendarClock,
  History,
  LayoutDashboard,
  type LucideIcon,
  PhoneCall,
  Settings,
  Users,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

export const mainNav: NavItem[] = [
  { title: "Visão geral", href: "/", icon: LayoutDashboard, description: "Indicadores e pendências da escala." },
  { title: "Calendário", href: "/calendario", icon: CalendarDays, description: "Escala mensal de pregações." },
  { title: "Pregadores", href: "/pregadores", icon: Users, description: "Cadastro de pregadores." },
  { title: "Disponibilidades", href: "/disponibilidades", icon: CalendarClock, description: "Disponibilidades futuras informadas." },
  { title: "Contatos", href: "/contatos", icon: PhoneCall, description: "Controle de convites e contatos." },
  { title: "Histórico", href: "/historico", icon: History, description: "Pregações já realizadas." },
]

export const secondaryNav: NavItem[] = [
  { title: "Configurações", href: "/configuracoes", icon: Settings, description: "Preferências do sistema." },
]

export const allNav = [...mainNav, ...secondaryNav]

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return mainNav[0]
  return allNav.find((item) => item.href !== "/" && pathname.startsWith(item.href))
}
