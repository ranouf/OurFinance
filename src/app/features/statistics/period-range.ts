export type StatisticsPeriod = 'month' | 'year' | 'all' | 'custom';

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export function periodRange(period: StatisticsPeriod, month: string, year: number, customStart?: string, customEnd?: string): { start?: string; end?: string } | undefined {
  if (period === 'all') return {};
  if (period === 'custom') return customStart && customEnd && validDate(customStart) && validDate(customEnd) && customStart <= customEnd ?
    { start: customStart, end: customEnd } : undefined;
  if (period === 'year') {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return undefined;
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return undefined;
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${lastDay}` };
}
