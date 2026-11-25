import { cookies } from "next/headers"
import { Suspense } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { PendingAccess } from "@/components/layout/pending-access"
import { SidebarUser } from "@/components/layout/sidebar-user"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAccess } from "@/lib/data/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"

/** Lê o estado salvo da sidebar (recolhida/expandida) do cookie. */
async function Shell({ children }: { children: React.ReactNode }) {
  const access = await getAccess()
  if (access.state === "pending") return <PendingAccess email={access.email} />
  if (access.state === "anonymous" && isSupabaseConfigured()) redirect("/login")

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        footer={
          <Suspense fallback={<Skeleton className="h-10 w-full rounded-lg" />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset className="min-w-0 bg-background">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ShellFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:block" />
      <div className="flex-1">
        <div className="h-16 border-b border-border" />
      </div>
    </div>
  )
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  )
}
