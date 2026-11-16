import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { periodRange } from '../../src/app/features/statistics/period-range';

test('les bornes mensuelles incluent le dernier jour d’une année bissextile', () => {
  deepStrictEqual(periodRange('month', '2024-02', 2024), { start: '2024-02-01', end: '2024-02-29' });
  deepStrictEqual(periodRange('month', '2025-02', 2025), { start: '2025-02-01', end: '2025-02-28' });
  strictEqual(periodRange('month', '2025-13', 2025), undefined);
});

test('les statistiques annuelles et totales gardent leurs périodes distinctes', () => {
  deepStrictEqual(periodRange('year', '', 2026), { start: '2026-01-01', end: '2026-12-31' });
  deepStrictEqual(periodRange('all', '', 0), {});
});

test('une plage personnalisée inclut ses deux bornes et refuse les dates inversées ou impossibles', () => {
  deepStrictEqual(periodRange('custom', '', 2026, '2024-02-29', '2024-03-01'), { start: '2024-02-29', end: '2024-03-01' });
  strictEqual(periodRange('custom', '', 2026, '2024-03-02', '2024-03-01'), undefined);
  strictEqual(periodRange('custom', '', 2026, '2025-02-29', '2025-03-01'), undefined);
  strictEqual(periodRange('custom', '', 2026, '', '2025-03-01'), undefined);
});
