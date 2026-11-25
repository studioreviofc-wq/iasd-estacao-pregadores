import type { Metadata } from "next"
import { Suspense } from "react"

import { BrandMark } from "@/components/layout/brand-mark"
import { Card } from "@/components/ui/card"
import { siteConfig } from "@/config/site"
import { isSupabaseConfigured } from "@/lib/supabase/env"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar" }

async function LoginFormWithRedirect({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams
  const redirect = typeof params.redirect === "string" ? params.redirect : "/"
  return <LoginForm redirectTo={redirect} disabled={!isSupabaseConfigured()} />
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const configured = isSupabaseConfigured()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-11 rounded-xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand-700">{siteConfig.name}</h1>
            <p className="text-sm text-muted-foreground">{siteConfig.product}</p>
          </div>
        </div>

        <Card className="gap-5 p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground">Use o e-mail cadastrado pela secretaria.</p>
          </div>
          {!configured ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              O banco de dados ainda não foi configurado. O acesso será liberado após a conexão com o Supabase.
            </p>
          ) : null}
          <Suspense fallback={<LoginForm redirectTo="/" disabled />}>
            <LoginFormWithRedirect searchParams={searchParams} />
          </Suspense>
        </Card>

        <p className="text-center text-xs text-muted-foreground">{siteConfig.churchName}</p>
      </div>
    </div>
  )
}
