import { LogOut } from "lucide-react"

import { signOut } from "@/app/login/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { getSessionUser } from "@/lib/data/session"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export async function SidebarUser() {
  const result = await getSessionUser()

  if (result.status === "unconfigured") {
    return (
      <div className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning group-data-[collapsible=icon]:hidden">
        Banco de dados não conectado
      </div>
    )
  }

  const user = result.data
  if (!user) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 group-data-[collapsible=icon]:px-0">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-brand-50 text-xs font-medium text-brand-600">
              {initials(user.name) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
        <form action={signOut} className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuButton type="submit" size="sm" tooltip="Sair" className="size-8 justify-center p-0" aria-label="Sair">
            <LogOut />
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
