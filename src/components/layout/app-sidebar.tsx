"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { mainNav, secondaryNav, type NavItem } from "@/config/navigation"
import { siteConfig } from "@/config/site"

import { BrandMark } from "./brand-mark"

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, item.href)}
            tooltip={item.title}
            className="h-9 data-[active=true]:font-medium"
          >
            <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:px-0">
          <BrandMark />
          <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold text-brand-700">{siteConfig.name}</span>
            <span className="truncate text-xs text-muted-foreground">{siteConfig.product}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel>Escala</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={mainNav} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <NavList items={secondaryNav} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {footer ? <SidebarFooter className="border-t border-sidebar-border">{footer}</SidebarFooter> : null}
      <SidebarRail />
    </Sidebar>
  )
}
