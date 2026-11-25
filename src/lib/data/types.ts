import type { AvailabilityRow, ContactLogRow, PreacherRow, ServiceRow } from "@/types/database"

export type PreacherSummary = Pick<PreacherRow, "id" | "full_name" | "category">

export type ServiceWithPreacher = ServiceRow & { preacher: PreacherSummary | null }

export type AvailabilityWithPreacher = AvailabilityRow & { preacher: PreacherSummary | null }

export type ContactLogWithRelations = ContactLogRow & {
  preacher: (PreacherSummary & Pick<PreacherRow, "phone" | "whatsapp">) | null
  service: Pick<ServiceRow, "id" | "service_date" | "service_type" | "period"> | null
}
