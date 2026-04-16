// ISO week / date utilities shared across app/ and lib/

/** Format a Date as YYYY-MM-DD using LOCAL time components (not UTC). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mondayOfISOWeek(weekStr: string): Date {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date();
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7);
  return monday;
}

export function getWeekDates(weekStr: string): string[] {
  const monday = mondayOfISOWeek(weekStr);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(toLocalDateStr(d));
  }
  return dates;
}

export function dateToISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  // Thursday of current week determines ISO year and week number
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - jan4.getTime()) / 86400000 -
        3 +
        ((jan4.getDay() + 6) % 7)) /
        7
    );
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function shiftWeek(weekStr: string, delta: number): string {
  const monday = mondayOfISOWeek(weekStr);
  monday.setDate(monday.getDate() + delta * 7);
  return dateToISOWeek(toLocalDateStr(monday));
}

/** "Apr 2026" — month determined by the Thursday (canonical ISO week date) */
export function weekMonthLabel(weekStr: string): string {
  const dates = getWeekDates(weekStr);
  if (dates.length < 4) return weekStr;
  const thursday = new Date(dates[3] + "T00:00:00");
  return thursday.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** "Mar 30 – Apr 5" or "Apr 6 – Apr 12" */
export function formatWeekRange(weekStr: string): string {
  const dates = getWeekDates(weekStr);
  if (dates.length < 7) return weekStr;
  const first = new Date(dates[0] + "T00:00:00");
  const last = new Date(dates[6] + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear()
  ) {
    return `${first.getDate()} – ${last.toLocaleDateString("en-IN", opts)}`;
  }
  return `${first.toLocaleDateString("en-IN", opts)} – ${last.toLocaleDateString("en-IN", opts)}`;
}

/** Oldest allowed week for navigation (90 days back) */
export function oldestAllowedWeek(todayStr: string): string {
  const d = new Date(todayStr + "T12:00:00");
  d.setDate(d.getDate() - 90);
  return dateToISOWeek(toLocalDateStr(d));
}

/** Extract total minutes since midnight in IST from an ISO timestamp */
export function extractISTMinutes(isoString: string): number | null {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    // UTC + 5:30
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    const istDate = new Date(istMs);
    return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  } catch {
    return null;
  }
}

/** 90 → "1:30 am", 810 → "1:30 pm" */
export function minutesToTimeStr(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.round(totalMin % 60);
  const period = h >= 12 ? "pm" : "am";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

export function shortDayName(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
  });
}

export function shortDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
