import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert';
import { calculateBalances, ExpenseLedgerEntry } from '../../src/app/shared/utils/ledger';
const expense: ExpenseLedgerEntry = {
  groupId: 'g1', currency: 'CAD', date: '2026-11-10', amountMinor: 101,
  payments: [{ userId: 'a', amountMinor: 101 }],
  allocations: [{ userId: 'a', amountMinor: 50 }, { userId: 'b', amountMinor: 51 }],
};
test('balances reconcile exactly after partial settlement', () => {
  const rows = calculateBalances([expense], [{ groupId: 'g1', currency: 'CAD', date: '2026-11-11', fromUserId: 'b', toUserId: 'a', amountMinor: 30 }]);
  strictEqual(rows.find(row => row.userId === 'a')?.balanceMinor, 21n);
  strictEqual(rows.find(row => row.userId === 'b')?.balanceMinor, -21n);
  strictEqual(rows.reduce((sum, row) => sum + row.balanceMinor, 0n), 0n);
});
test('group, currency and date remain separate', () => {
  const rows = calculateBalances([expense, { ...expense, groupId: 'g2', currency: 'JPY', date: '2026-10-01' }], [], '2026-11-01', '2026-11-30');
  strictEqual(rows.length, 2);
  deepStrictEqual(new Set(rows.map(row => row.currency)), new Set(['CAD']));
});
test('FX settlement clears the CAD debt without creating a JPY debt', () => {
  const rows = calculateBalances([expense], [], undefined, undefined, [{ groupId: 'g1', date: '2026-11-11',
    debtCurrency: 'CAD', debtAmountMinor: 51, paymentCurrency: 'JPY', paymentAmountMinor: 1,
    rate: '2', rateDate: '2026-11-11', fromUserId: 'b', toUserId: 'a' }]);
  strictEqual(rows.find(row => row.userId === 'a' && row.currency === 'CAD')?.balanceMinor, 0n);
  strictEqual(rows.find(row => row.userId === 'b' && row.currency === 'CAD')?.balanceMinor, 0n);
  strictEqual(rows.some(row => row.currency === 'JPY'), false);
});
