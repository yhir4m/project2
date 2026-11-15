/** Fecha (YYYY-MM-DD) en la zona de Ciudad de México, igual que `(x at time zone 'America/Mexico_City')::date`. */
export function fechaCdmx(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
