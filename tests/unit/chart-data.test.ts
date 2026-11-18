import { deepStrictEqual, strictEqual } from 'node:assert';
import { test } from 'node:test';
import { chartData } from '../../src/app/features/statistics/chart-data';
import type { ExpenseLedgerEntry, SettlementLedgerEntry } from '../../src/app/shared/utils/ledger';

const expenses: ExpenseLedgerEntry[] = [
  { groupId: 'g', currency: 'CAD', date: '2026-01-31', amountMinor: 101, categoryId: 'groceries', payments: [{ userId: 'a', amountMinor: 101 }], allocations: [{ userId: 'a', amountMinor: 51 }, { userId: 'b', amountMinor: 50 }] },
  { groupId: 'g', currency: 'CAD', date: '2026-02-01', amountMinor: 200, categoryId: 'rent', categoryLabel: 'Loyer du groupe', payments: [{ userId: 'b', amountMinor: 200 }], allocations: [{ userId: 'a', amountMinor: 100 }, { userId: 'b', amountMinor: 100 }] },
  { groupId: 'g', currency: 'CAD', date: '2026-02-03', amountMinor: 300, categoryId: 'other', payments: [{ userId: 'a', amountMinor: 300 }], allocations: [{ userId: 'a', amountMinor: 300 }], deleted: true },
  { groupId: 'g', currency: 'JPY', date: '2026-02-02', amountMinor: 500, categoryId: 'other', payments: [{ userId: 'a', amountMinor: 500 }], allocations: [{ userId: 'a', amountMinor: 500 }] },
];
const settlements: SettlementLedgerEntry[] = [
  { groupId: 'g', currency: 'CAD', date: '2026-02-02', amountMinor: 25, fromUserId: 'b', toUserId: 'a' },
];

test('les graphiques gardent catégorie, période et devise sans confondre paiement, part et solde', () => {
  const result = chartData(expenses, settlements, 'CAD', '2026-01-31', '2026-02-02', 'months');
  strictEqual(result.totalMinor, 301n);
  deepStrictEqual(result.categories.map(row => [row.label, row.amountMinor]), [['Loyer du groupe', 200n], ['Épicerie', 101n]]);
  deepStrictEqual(result.timeline.map(row => [row.period, row.amountMinor]), [['2026-01', 101n], ['2026-02', 200n]]);
  const a = result.members.find(row => row.userId === 'a')!;
  strictEqual(a.paidMinor, 101n);
  strictEqual(a.owedMinor, 151n);
  strictEqual(a.balanceMinor, -75n);
  const b = result.members.find(row => row.userId === 'b')!;
  strictEqual(b.balanceMinor, 75n);
});

test('les périodes sans dépense ne créent aucun point et les remboursements gardent leur solde', () => {
  const result = chartData(expenses, settlements, 'CAD', '2026-02-02', '2026-02-02', 'days');
  strictEqual(result.totalMinor, 0n);
  deepStrictEqual(result.timeline, []);
  strictEqual(result.members.find(row => row.userId === 'a')?.balanceMinor, -25n);
  strictEqual(result.members.find(row => row.userId === 'b')?.balanceMinor, 25n);
});

test('l’évolution suit l’unité jours ou années choisie sans inclure une date hors bornes', () => {
  deepStrictEqual(chartData(expenses, [], 'CAD', '2026-01-31', '2026-02-01', 'days').timeline.map(point => point.period), ['2026-01-31', '2026-02-01']);
  deepStrictEqual(chartData(expenses, [], 'CAD', '2026-02-01', '2026-12-31', 'years').timeline.map(point => [point.period, point.amountMinor]), [['2026', 200n]]);
});

test('les catégories identiques fusionnent et les dates sont triées sans mélanger les remboursements exclus', () => {
  const repeated = [...expenses, { ...expenses[0], date: '2026-02-04', amountMinor: 50,
    payments: [{ userId: 'a', amountMinor: 50 }], allocations: [{ userId: 'a', amountMinor: 50 }] }];
  const result = chartData(repeated, [...settlements, { ...settlements[0], deleted: true, amountMinor: 999 }],
    'CAD', '2026-01-01', '2026-12-31', 'days');
  strictEqual(result.categories.find(row => row.id === 'groceries')?.amountMinor, 151n);
  deepStrictEqual(result.timeline.map(row => row.period), ['2026-01-31', '2026-02-01', '2026-02-04']);
  strictEqual(result.members.find(row => row.userId === 'a')?.settlementsReceivedMinor, 25n);
});
