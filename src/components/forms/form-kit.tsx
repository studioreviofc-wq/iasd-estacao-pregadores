"use client"

import { AlertCircle, Loader2 } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ActionState } from "@/lib/actions/state"
import { cn } from "@/lib/utils"

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)} data-invalid={error ? true : undefined}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormAlert({ state }: { state: ActionState }) {
  if (state.status !== "error" || !state.fieldErrors) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      {state.message}
    </div>
  )
}

export function SubmitButton({ pending, children, className }: { pending: boolean; children: ReactNode; className?: string }) {
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}

export type Option = { value: string; label: string; hint?: string }

/** Select do shadcn que envia o valor no FormData (`name`). */
export function SelectField({
  id,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  placeholder,
  invalid,
}: {
  id?: string
  name: string
  options: Option[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <Select name={name} defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-9 w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder ?? "Selecione"} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span>{o.label}</span>
            {o.hint ? <span className="ml-1 text-xs text-muted-foreground">{o.hint}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">{children}</div>
}
