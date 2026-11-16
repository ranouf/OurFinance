import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMinor, prepareExpense, type ExpenseDraft } from '../../src/app/features/expenses/expense-draft';

const members = new Set(['alex', 'camille']);
function draft(kind: ExpenseDraft['kind'], values: [string, string]): ExpenseDraft {
  return { description: 'Test fictif', amount: '1.01', currency: 'CAD', date: '2026-11-16', payerId: 'alex', kind,
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
