"use client"

import { ExternalLink, MessageCircle } from "lucide-react"
import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { Field, FormActions } from "@/components/forms/form-kit"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatBrPhone, renderWhatsappTemplate, whatsappUrl } from "@/lib/domain/phone"
import { cn } from "@/lib/utils"

export type WhatsappTarget = { full_name: string; phone: string | null; whatsapp: string | null }
export type WhatsappContext = { template: string; churchName: string }

/**
 * Abre uma conversa no WhatsApp com mensagem pré-preenchida e editável.
 * Nada é enviado automaticamente: o usuário revisa e envia no próprio WhatsApp.
 */
export function WhatsappButton({
  preacher,
  context,
  variant = "icon",
  className,
}: {
  preacher: WhatsappTarget
  context: WhatsappContext
  variant?: "icon" | "full"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const number = preacher.whatsapp ?? preacher.phone
  const valid = Boolean(whatsappUrl(number))

  const trigger =
    variant === "icon" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!valid}
        onClick={() => setOpen(true)}
        className={cn("text-success hover:bg-success/10 hover:text-success", className)}
        aria-label={`WhatsApp de ${preacher.full_name}`}
      >
        <MessageCircle />
      </Button>
    ) : (
      <Button type="button" variant="outline" disabled={!valid} onClick={() => setOpen(true)} className={className}>
        <MessageCircle data-icon="inline-start" className="text-success" />
        WhatsApp
      </Button>
    )

  return (
    <>
      {variant === "icon" ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{valid ? "Conversar no WhatsApp" : "Telefone inválido"}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Conversar no WhatsApp"
        description={`${preacher.full_name} · ${formatBrPhone(number)}`}
      >
        {open ? <WhatsappComposer number={number} preacher={preacher} context={context} onDone={() => setOpen(false)} /> : null}
      </FormDialog>
    </>
  )
}

function WhatsappComposer({
  number,
  preacher,
  context,
  onDone,
}: {
  number: string | null
  preacher: WhatsappTarget
  context: WhatsappContext
  onDone: () => void
}) {
  const [message, setMessage] = useState(() =>
    renderWhatsappTemplate(context.template, { nome: preacher.full_name, igreja: context.churchName })
  )
  const url = whatsappUrl(number, message)

  return (
    <div className="space-y-4">
      <Field label="Mensagem" htmlFor="wa-message" hint="Edite à vontade. O modelo padrão é configurado em Configurações.">
        <Textarea id="wa-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        O WhatsApp será aberto com o texto pronto. A mensagem só é enviada quando você tocar em enviar no próprio WhatsApp.
      </p>
      <FormActions>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button asChild disabled={!url}>
          <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" onClick={onDone}>
            <ExternalLink data-icon="inline-start" />
            Abrir WhatsApp
          </a>
        </Button>
      </FormActions>
    </div>
  )
}
