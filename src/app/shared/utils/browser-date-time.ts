export enum BrowserDateTimeFormat {
  Date = 'date',
  DateTime = 'dateTime',
  ShortDate = 'shortDate',
  LongDate = 'longDate',
  Month = 'month',
  MonthYear = 'monthYear',
  ShortWeekday = 'shortWeekday',
  Weekday = 'weekday',
  Day = 'day',
  DayMonth = 'dayMonth',
  Year = 'year',
}

const formats: Record<BrowserDateTimeFormat, Intl.DateTimeFormatOptions> = {
  [BrowserDateTimeFormat.Date]: { year: 'numeric', month: 'numeric', day: 'numeric' },
  [BrowserDateTimeFormat.DateTime]: { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  [BrowserDateTimeFormat.ShortDate]: { year: 'numeric', month: 'short', day: 'numeric' },
  [BrowserDateTimeFormat.LongDate]: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  [BrowserDateTimeFormat.Month]: { month: 'long' },
  [BrowserDateTimeFormat.MonthYear]: { year: 'numeric', month: 'long' },
  [BrowserDateTimeFormat.ShortWeekday]: { weekday: 'short' },
  [BrowserDateTimeFormat.Weekday]: { weekday: 'long' },
  [BrowserDateTimeFormat.Day]: { day: 'numeric' },
  [BrowserDateTimeFormat.DayMonth]: { day: 'numeric', month: 'short' },
  [BrowserDateTimeFormat.Year]: { year: 'numeric' },
};

/** Date-only ISO values denote calendar days, never instants that may shift time zones. */
export function formatBrowserDateTime(
  value: string | number | Date | null | undefined,
  format: BrowserDateTimeFormat = BrowserDateTimeFormat.DateTime,
  locale?: string | readonly string[],
  timeZone?: string,
): string {
  if (value === null || value === undefined || value === '') return '';
  const calendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = calendarDate ? new Date(`${value}T00:00:00Z`) : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (calendarDate && date.toISOString().slice(0, 10) !== value) return '';
  const browserLocales = typeof navigator !== 'undefined' && navigator.languages.length ? navigator.languages : undefined;
  return new Intl.DateTimeFormat(locale ?? browserLocales, {
    ...formats[format],
    timeZone: calendarDate ? 'UTC' : timeZone,
  }).format(date);
}
