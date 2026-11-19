export type SelectionUnit = 'days' | 'months' | 'years';

export function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function selectionFromRange(range: { start: string; end: string; unit?: SelectionUnit }): { unit: SelectionUnit; first: string; last: string } {
  const unit = range.unit ?? 'days';
  const length = unit === 'days' ? 10 : unit === 'months' ? 7 : 4;
  return { unit, first: range.start.slice(0, length), last: range.end.slice(0, length) };
}

export function selectedRange(unit: SelectionUnit, first: string, last: string): { start: string; end: string } | undefined {
  if (!first || !last || first > last) return undefined;
  if (unit === 'days') {
    const valid = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    return valid(first) && valid(last) ? { start: first, end: last } : undefined;
  }
  if (unit === 'months') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(first) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(last)) return undefined;
    const endDay = new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0)).getUTCDate();
    return { start: `${first}-01`, end: `${last}-${endDay}` };
  }
  if (!/^(19|20)\d{2}$|^2100$/.test(first) || !/^(19|20)\d{2}$|^2100$/.test(last)) return undefined;
  return { start: `${first}-01-01`, end: `${last}-12-31` };
}

