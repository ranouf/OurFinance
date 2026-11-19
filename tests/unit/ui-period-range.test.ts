import assert from 'node:assert/strict';
import test from 'node:test';
import { selectedRange, selectionFromRange } from '../../src/app/shared/components/ui-period-range/ui-period-range-model';

test('a single day, month or year expands to inclusive dates', () => {
  assert.deepEqual(selectedRange('days', '2026-11-17', '2026-11-17'), { start: '2026-11-17', end: '2026-11-17' });
  assert.deepEqual(selectedRange('months', '2024-02', '2024-02'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(selectedRange('years', '2026', '2026'), { start: '2026-01-01', end: '2026-12-31' });
});

test('range boundaries and selected tab survive reopening', () => {
  assert.deepEqual(selectedRange('months', '2025-11', '2026-02'), { start: '2025-11-01', end: '2026-02-28' });
  assert.deepEqual(selectionFromRange({ start: '2025-11-01', end: '2026-02-28', unit: 'months' }), { unit: 'months', first: '2025-11', last: '2026-02' });
  assert.equal(selectedRange('days', '2026-02-31', '2026-02-31'), undefined);
});
