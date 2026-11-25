"use client"

import { Archive, ArchiveRestore, Pencil } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setPreacherArchived } from "@/app/(app)/pregadores/actions"
import { ConfirmDialog } from "@/components/forms/confirm-dialog"
import { FormDialog } from "@/components/forms/form-dialog"
import { Button } from "@/components/ui/button"
import { WhatsappButton, type WhatsappContext } from "@/components/whatsapp/whatsapp-dialog"
import type { PreacherRow } from "@/types/database"

import { PreacherForm } from "./preacher-form"

export function ProfileActions({
  preacher,
  canEdit,
  whatsapp,
}: {
  preacher: PreacherRow
  canEdit: boolean
  whatsapp: WhatsappContext
}) {
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const r = await setPreacherArchived(preacher.id, false)
      if (r.status === "success") toast.success(r.message)
      else if (r.status === "error") toast.error(r.message)
    })
  }

  return (
    <>
      <WhatsappButton preacher={preacher} context={whatsapp} variant="full" />
      {canEdit ? (
        <>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
          {preacher.archived_at ? (
            <Button variant="outline" onClick={restore} disabled={pending}>
              <ArchiveRestore data-icon="inline-start" />
              Restaurar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setArchiving(true)}>
              <Archive data-icon="inline-start" />
              Arquivar
            </Button>
          )}
        </>
      ) : null}

      <FormDialog open={editing} onOpenChange={setEditing} title="Editar pregador" description="Nome completo e telefone com DDD são obrigatórios.">
        {editing ? <PreacherForm preacher={preacher} onDone={() => setEditing(false)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Arquivar ${preacher.full_name}?`}
        description="O pregador sai das listas e da escala, mas todo o histórico é preservado. É possível restaurar depois."
        confirmLabel="Arquivar"
        onConfirm={() => setPreacherArchived(preacher.id, true)}
      />
    </>
  )
}
