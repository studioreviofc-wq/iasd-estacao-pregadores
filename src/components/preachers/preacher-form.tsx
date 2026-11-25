"use client"

import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"

import { checkPreacherDuplicates, savePreacher } from "@/app/(app)/pregadores/actions"
import { Field, FormActions, FormAlert, SelectField, SubmitButton } from "@/components/forms/form-kit"
import { useFormAction } from "@/components/forms/use-form-action"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { DuplicateMatch } from "@/lib/domain/duplicates"
import { preacherCategoryLabel } from "@/lib/domain/labels"
import { formatBrPhone, validateBrPhone } from "@/lib/domain/phone"
import { WEEKDAYS } from "@/lib/domain/weekdays"
import { cn } from "@/lib/utils"
import { preacherCategories } from "@/lib/validation/preacher"
import type { PreacherRow } from "@/types/database"

const categoryOptions = preacherCategories.map((c) => ({ value: c, label: preacherCategoryLabel[c] }))

function DuplicateWarning({ matches, onConfirm, pending }: { matches: DuplicateMatch[]; onConfirm?: () => void; pending?: boolean }) {
  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm" role="alert">
      <p className="flex items-center gap-2 font-medium text-warning">
        <AlertTriangle className="size-4" />
        Possível cadastro duplicado
      </p>
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m.id} className="text-muted-foreground">
            <Link href={`/pregadores/${m.id}`} target="_blank" className="font-medium text-foreground hover:text-primary hover:underline">
              {m.full_name}
            </Link>
            {m.phone ? ` · ${m.phone}` : ""} — {m.reason}
            {m.archived ? " (arquivado)" : ""}
          </li>
        ))}
      </ul>
      {onConfirm ? (
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" onClick={onConfirm} disabled={pending}>
            É outra pessoa — salvar mesmo assim
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Confira antes de salvar. Você poderá confirmar se for outra pessoa.</p>
      )}
    </div>
  )
}

export function PreacherForm({ preacher, onDone }: { preacher?: PreacherRow; onDone: () => void }) {
  const { state, pending, onSubmit, fieldError } = useFormAction(savePreacher, { onSuccess: onDone })
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [liveDuplicates, setLiveDuplicates] = useState<DuplicateMatch[]>([])

  const serverDuplicates = state.status === "error" ? state.duplicates : undefined

  async function lookup() {
    const form = formRef.current
    if (!form) return
    const name = (form.elements.namedItem("full_name") as HTMLInputElement).value
    const phone = (form.elements.namedItem("phone") as HTMLInputElement).value
    setLiveDuplicates(await checkPreacherDuplicates({ full_name: name, phone, excludeId: preacher?.id }))
  }

  function onPhoneBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value
    const error = value ? validateBrPhone(value) : null
    setPhoneError(error)
    if (!error && value) e.target.value = formatBrPhone(value)
    void lookup()
  }

  function confirmDuplicate() {
    if (confirmRef.current) confirmRef.current.value = "on"
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {preacher ? <input type="hidden" name="id" value={preacher.id} /> : null}
      <input ref={confirmRef} type="hidden" name="confirm_duplicate" defaultValue="" />
      {serverDuplicates?.length ? null : <FormAlert state={state} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="full_name" required error={fieldError("full_name")} hint="Pode ser só o primeiro nome.">
          <Input
            id="full_name"
            name="full_name"
            defaultValue={preacher?.full_name}
            autoFocus
            autoComplete="off"
            onBlur={() => void lookup()}
          />
        </Field>
        <Field label="Apelido" htmlFor="nickname" error={fieldError("nickname")} hint="Como é conhecido(a). Ex.: Teté">
          <Input id="nickname" name="nickname" defaultValue={preacher?.nickname ?? ""} autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Igreja de origem" htmlFor="home_church" error={fieldError("home_church")}>
          <Input id="home_church" name="home_church" defaultValue={preacher?.home_church ?? ""} placeholder="Ex.: Central, Lagarto 3" />
        </Field>
        <Field
          label="Telefone com DDD"
          htmlFor="phone"
          error={fieldError("phone") ?? phoneError ?? undefined}
          hint="Opcional. Ex.: (82) 99999-9999"
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={preacher?.phone ?? ""}
            placeholder="(00) 00000-0000"
            onBlur={onPhoneBlur}
          />
        </Field>
      </div>

      {serverDuplicates?.length ? (
        <DuplicateWarning matches={serverDuplicates} onConfirm={confirmDuplicate} pending={pending} />
      ) : liveDuplicates.length ? (
        <DuplicateWarning matches={liveDuplicates} />
      ) : null}

      <details className="group rounded-lg border border-border px-3 py-2 [&[open]]:pb-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none group-open:mb-3">
          Mais informações (opcional)
        </summary>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Função" htmlFor="category" error={fieldError("category")}>
              <SelectField id="category" name="category" options={categoryOptions} defaultValue={preacher?.category ?? "membro"} />
            </Field>
            <Field label="Cargo" htmlFor="role_title" error={fieldError("role_title")}>
              <Input id="role_title" name="role_title" defaultValue={preacher?.role_title ?? ""} placeholder="Ex.: Pastor distrital" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp (se for outro número)" htmlFor="whatsapp" error={fieldError("whatsapp")}>
              <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={preacher?.whatsapp ?? ""} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={fieldError("email")}>
              <Input id="email" name="email" type="email" defaultValue={preacher?.email ?? ""} />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Dias de preferência</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-colors",
                    "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground"
                  )}
                >
                  <Checkbox
                    name="preferred_weekdays"
                    value={String(d.value)}
                    defaultChecked={preacher?.preferred_weekdays.includes(d.value)}
                    className="size-3.5"
                  />
                  {d.short}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      <Field label="Observações gerais" htmlFor="notes" error={fieldError("notes")}>
        <Textarea id="notes" name="notes" rows={3} defaultValue={preacher?.notes ?? ""} placeholder="Ex.: só consegue a partir de janeiro; já pregou em novembro" />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="is_active" name="is_active" defaultChecked={preacher?.is_active ?? true} />
        <Label htmlFor="is_active" className="font-normal">
          Ativo (pode ser escalado)
        </Label>
      </div>

      <FormActions>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{preacher ? "Salvar alterações" : "Cadastrar pregador"}</SubmitButton>
      </FormActions>
    </form>
  )
}
