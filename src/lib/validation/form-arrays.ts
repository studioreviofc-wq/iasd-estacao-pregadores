/** Campos multivalorados do FormData usados pelos formulários de contato/disponibilidade. */
export function availabilityArrays(formData: FormData) {
  return {
    av_months: formData.getAll("av_months").map(String).filter(Boolean),
    av_dates: formData.getAll("av_dates").map(String).filter(Boolean),
    av_weekdays: formData.getAll("av_weekdays").map(String).filter(Boolean),
  }
}
