import { Clock, LogOut } from "lucide-react"

import { signOut } from "@/app/login/actions"
import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { siteConfig } from "@/config/site"

/** Tela para usuários autenticados que ainda não foram liberados pelo administrador. */
export function PendingAccess({ email }: { email: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md gap-5 p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-11 rounded-xl" />
          <span className="flex size-10 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Clock className="size-5" />
          </span>
          <h1 className="text-lg font-semibold">Acesso aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta <strong className="text-foreground">{email}</strong> foi criada, mas ainda precisa ser liberada por um
            administrador do {siteConfig.name}. Nenhum dado é exibido até lá.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut data-icon="inline-start" />
            Sair
          </Button>
        </form>
      </Card>
    </div>
  )
}
