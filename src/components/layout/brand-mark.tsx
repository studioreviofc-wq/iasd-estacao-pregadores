import Image from "next/image"
import { BookOpen } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * Símbolo da marca. Usa o logotipo oficial quando `siteConfig.logoSrc`
 * estiver definido; caso contrário, exibe um símbolo provisório neutro.
 */
export function BrandMark({ className }: { className?: string }) {
  if (siteConfig.logoSrc) {
    return (
      <Image
        src={siteConfig.logoSrc}
        alt="Igreja Adventista do Sétimo Dia"
        width={32}
        height={32}
        className={cn("size-8 shrink-0 object-contain", className)}
        priority
      />
    )
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className
      )}
    >
      <BookOpen className="size-4" strokeWidth={2.25} />
    </div>
  )
}
