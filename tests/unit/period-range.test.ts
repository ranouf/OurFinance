import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { periodRange, selectedRange } from '../../src/app/features/statistics/period-range';

test('les bornes mensuelles incluent le dernier jour d’une année bissextile', () => {
  deepStrictEqual(periodRange('month', '2024-02', 2024), { start: '2024-02-01', end: '2024-02-29' });
  deepStrictEqual(periodRange('month', '2025-02', 2025), { start: '2025-02-01', end: '2025-02-28' });
  strictEqual(periodRange('month', '2025-13', 2025), undefined);
});

test('les statistiques annuelles et totales gardent leurs périodes distinctes', () => {
  deepStrictEqual(periodRange('year', '', 2026), { start: '2026-01-01', end: '2026-12-31' });
  deepStrictEqual(periodRange('all', '', 0), {});
});

test('les sélections de jours, mois et années ont des bornes inclusives sans décalage horaire', () => {
  deepStrictEqual(selectedRange('days', '2026-11-15', '2026-11-16'), { start: '2026-11-15', end: '2026-11-16' });
  deepStrictEqual(selectedRange('months', '2020-05', '2023-06'), { start: '2020-05-01', end: '2023-06-30' });
  deepStrictEqual(selectedRange('years', '2024', '2025'), { start: '2024-01-01', end: '2025-12-31' });
  strictEqual(selectedRange('days', '2026-02-31', '2026-03-01'), undefined);
  strictEqual(selectedRange('months', '2023-06', '2020-05'), undefined);
  strictEqual(selectedRange('years', '2024', '2101'), undefined);
});
