export function formatEventDate(event) {
  const start = event?.date ? String(event.date).slice(0, 10) : "";
  const end = event?.end_date ? String(event.end_date).slice(0, 10) : "";
  if (!start) return "No date";
  if (!end || end === start) return start;
  return `${start} → ${end}`;
}
