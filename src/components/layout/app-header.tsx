"use client"

import { usePathname } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { findNavItem } from "@/config/navigation"
import { siteConfig } from "@/config/site"

export function AppHeader() {
  const pathname = usePathname()
  const current = findNavItem(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground" aria-label="Alternar menu lateral" />
      <span aria-hidden className="h-5 w-px bg-border" />
      <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-muted-foreground sm:inline">{siteConfig.name}</span>
        <span className="hidden text-muted-foreground/60 sm:inline">/</span>
        <span className="truncate font-medium">{current?.title ?? "Página"}</span>
      </nav>
    </header>
  )
}
