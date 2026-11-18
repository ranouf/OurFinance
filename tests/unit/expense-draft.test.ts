import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMinor, prepareExpense, type ExpenseDraft } from '../../src/app/features/expenses/expense-draft';

const members = new Set(['alex', 'camille']);
function draft(kind: ExpenseDraft['kind'], values: [string, string]): ExpenseDraft {
  return { description: 'Test fictif', amount: '1.01', currency: 'CAD', date: '2026-11-16', categoryId: 'other', payerId: 'alex', multiplePayers: false, paymentRows: [], kind,
    rows: [{ userId: 'alex', selected: true, value: values[0] }, { userId: 'camille', selected: true, value: values[1] }] };
}
test('saisie décimale exacte pour devises à zéro, deux et trois décimales', () => {
  assert.equal(parseMinor('101', 'JPY'), 101);
  assert.equal(parseMinor('1,01', 'CAD'), 101);
  assert.equal(parseMinor('1.001', 'KWD'), 1001);
  assert.throws(() => parseMinor('1.001', 'CAD'));
});
test('les cinq modes conservent exactement le montant', () => {
  const cases: [ExpenseDraft['kind'], [string, string]][] = [
    ['equal', ['', '']], ['exact', ['0.50', '0.51']], ['percentage', ['50', '50']],
    ['shares', ['1', '1']], ['adjustment', ['0', '0']],
  ];
  for (const [kind, values] of cases) {
    const result = prepareExpense(draft(kind, values), members);
    assert.equal(result.allocations.reduce((sum, row) => sum + row.amountMinor, 0), 101, kind);
    assert.equal(result.payments[0].amountMinor, 101);
  }
});
test('un membre révoqué et un total de pourcentages incomplet sont refusés', () => {
  assert.throws(() => prepareExpense(draft('equal', ['', '']), new Set(['alex'])));
  assert.throws(() => prepareExpense(draft('percentage', ['40', '50']), members));
});
test('plusieurs payeurs conservent les montants exacts', () => {
  const expense = draft('equal', ['', '']);
  expense.multiplePayers = true;
  expense.paymentRows = [{ userId: 'alex', selected: true, value: '0.50' }, { userId: 'camille', selected: true, value: '0.51' }];
  assert.deepEqual(prepareExpense(expense, members).payments, [
    { userId: 'alex', amountMinor: 50 }, { userId: 'camille', amountMinor: 51 },
  ]);
  expense.paymentRows[1].value = '0.50';
  assert.throws(() => prepareExpense(expense, members), /somme des paiements/);
  expense.paymentRows[1].value = '0.51';
  expense.rows[1].selected = false;
  assert.throws(() => prepareExpense(expense, new Set(['alex'])), /payeurs actifs/);
});
