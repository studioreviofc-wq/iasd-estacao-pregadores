import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"

/** Container padrão para tabelas: rolagem horizontal no mobile. */
export function TableCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="overflow-x-auto [&_td]:px-4 [&_td]:py-3 [&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_thead_tr]:bg-muted/50">
        {children}
      </div>
      {footer ? <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  )
}
