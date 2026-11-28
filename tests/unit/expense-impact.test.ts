import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseImpact } from '../../src/app/features/expenses/expense-impact';
import type { ExpenseDraft } from '../../src/app/features/expenses/expense-draft';

const members = new Set(['alex', 'camille']);
const draft: ExpenseDraft = {
  description: 'Repas fictif', amount: '100.00', currency: 'CAD', date: '2026-11-27', categoryId: 'restaurant',
  payerId: 'alex', multiplePayers: false, paymentRows: [], kind: 'percentage',
  rows: [{ userId: 'alex', selected: true, value: '60' }, { userId: 'camille', selected: true, value: '40' }],
};

test('le solde de cette seule dépense distingue paiement et part attribuée', () => {
  assert.deepEqual(expenseImpact(draft, members, 'alex'), { total: 10000, paid: 10000, owed: 6000, net: 4000 });
  assert.deepEqual(expenseImpact(draft, members, 'camille'), { total: 10000, paid: 0, owed: 4000, net: -4000 });
});

test('les payeurs multiples et une répartition invalide ne fabriquent aucun solde', () => {
  const shared = { ...draft, multiplePayers: true, paymentRows: [
    { userId: 'alex', selected: true, value: '70.00' }, { userId: 'camille', selected: true, value: '30.00' },
  ] };
  assert.equal(expenseImpact(shared, members, 'alex').net, 1000);
  assert.equal(expenseImpact(shared, members, 'camille').net, -1000);
  assert.throws(() => expenseImpact({ ...draft, rows: [{ ...draft.rows[0], value: '60' }, { ...draft.rows[1], value: '39' }] }, members, 'alex'));
});
