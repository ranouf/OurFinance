export type StatisticsPeriod = 'month' | 'year' | 'all';

export function periodRange(period: StatisticsPeriod, month: string, year: number): { start?: string; end?: string } | undefined {
  if (period === 'all') return {};
  if (period === 'year') {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return undefined;
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return undefined;
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${lastDay}` };
}
