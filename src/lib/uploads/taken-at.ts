export const UNKNOWN_TAKEN_AT = "unknown";

const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

export function localTodayDateValue(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateValueInTimeZone(now = new Date(), timeZone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function takenAtDatePart(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === UNKNOWN_TAKEN_AT) return UNKNOWN_TAKEN_AT;
  const datePart = trimmed.slice(0, 10);
  return DATE_VALUE_PATTERN.test(datePart) && isCalendarDate(datePart) ? datePart : null;
}

export function takenAtIsAllowed(value: unknown, today: string) {
  const datePart = takenAtDatePart(value);
  return datePart === UNKNOWN_TAKEN_AT || (datePart !== null && datePart <= today);
}

export function takenAtIsFuture(value: unknown, today: string) {
  const datePart = takenAtDatePart(value);
  return datePart !== null && datePart !== UNKNOWN_TAKEN_AT && datePart > today;
}
