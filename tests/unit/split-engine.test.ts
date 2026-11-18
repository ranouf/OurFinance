import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { splitAmount, validateExpense } from '../../src/app/shared/utils/split-engine';

const ids = ['a', 'b', 'c'];
test('equal split conserves every minor unit with deterministic remainder', () => {
  deepStrictEqual(splitAmount(100, { kind: 'equal', users: ids }), [
    { userId: 'a', amountMinor: 34 }, { userId: 'b', amountMinor: 33 }, { userId: 'c', amountMinor: 33 },
  ]);
  strictEqual(splitAmount(1, { kind: 'equal', users: ['a'] })[0].amountMinor, 1);
});
test('percentages, exact amounts and shares conserve total', () => {
  for (const mode of [
    { kind: 'percentage' as const, weightsBasisPoints: [{ userId: 'a', value: 2500 }, { userId: 'b', value: 7500 }] },
    { kind: 'exact' as const, amounts: [{ userId: 'a', amountMinor: 25 }, { userId: 'b', amountMinor: 75 }] },
    { kind: 'shares' as const, weights: [{ userId: 'a', value: 1 }, { userId: 'b', value: 3 }] },
  ]) strictEqual(splitAmount(100, mode).reduce((sum, item) => sum + item.amountMinor, 0), 100);
});
test('adjustments allocate the rest equally', () => {
  deepStrictEqual(splitAmount(101, { kind: 'adjustment', adjustments: [
    { userId: 'a', amountMinor: 10 }, { userId: 'b', amountMinor: 0 },
  ] }), [{ userId: 'a', amountMinor: 56 }, { userId: 'b', amountMinor: 45 }]);
});
test('rejects invalid sums and outsiders', () => {
  throws(() => splitAmount(100, { kind: 'percentage', weightsBasisPoints: [{ userId: 'a', value: 9900 }] }));
  throws(() => splitAmount(100, { kind: 'exact', amounts: [{ userId: 'a', amountMinor: 99 }] }));
  throws(() => validateExpense(100, [{ userId: 'a', amountMinor: 100 }], [{ userId: 'b', amountMinor: 100 }], new Set(['a'])));
});

test('split engine rejects duplicate, negative, unsafe and impossible allocations', () => {
  for (const mode of [
    { kind: 'equal' as const, users: [] },
    { kind: 'equal' as const, users: ['a', 'a'] },
    { kind: 'shares' as const, weights: [{ userId: 'a', value: 0 }] },
    { kind: 'shares' as const, weights: [{ userId: 'a', value: -1 }] },
    { kind: 'shares' as const, weights: [{ userId: 'a', value: 1.5 }] },
    { kind: 'percentage' as const, weightsBasisPoints: [{ userId: 'a', value: -1 }, { userId: 'b', value: 10001 }] },
    { kind: 'exact' as const, amounts: [{ userId: 'a', amountMinor: -1 }, { userId: 'b', amountMinor: 101 }] },
    { kind: 'exact' as const, amounts: [{ userId: 'a', amountMinor: 50 }, { userId: 'a', amountMinor: 50 }] },
    { kind: 'adjustment' as const, adjustments: [{ userId: 'a', amountMinor: 101 }] },
    { kind: 'adjustment' as const, adjustments: [{ userId: 'a', amountMinor: 1.5 }] },
  ]) throws(() => splitAmount(100, mode));
  throws(() => splitAmount(Number.MAX_SAFE_INTEGER + 1, { kind: 'equal', users: ['a'] }));
  throws(() => validateExpense(100, [{ userId: 'a', amountMinor: 50 }], [{ userId: 'a', amountMinor: 100 }], new Set(['a'])));
  throws(() => validateExpense(100, [{ userId: 'a', amountMinor: 100 }], [{ userId: 'a', amountMinor: 50 }, { userId: 'a', amountMinor: 50 }], new Set(['a'])));
});

test('weighted remainders are deterministic and keep zero-share members', () => {
  deepStrictEqual(splitAmount(1, { kind: 'shares', weights: [
    { userId: 'a', value: 1 }, { userId: 'b', value: 1 }, { userId: 'c', value: 0 },
  ] }), [{ userId: 'a', amountMinor: 1 }, { userId: 'b', amountMinor: 0 }, { userId: 'c', amountMinor: 0 }]);
});

test('currency exponent follows Intl for zero, two and three digits', async () => {
  const { minorDigits } = await import('../../src/app/shared/utils/currency');
  strictEqual(minorDigits('JPY'), 0);
  strictEqual(minorDigits('CAD'), 2);
  strictEqual(minorDigits('KWD'), 3);
});

test('currency formatting rejects invalid money and preserves exact large signed values', async () => {
  const { currencyCatalog, formatMinor, formatMinorExact, minorDigits } = await import('../../src/app/shared/utils/currency');
  throws(() => minorDigits('ZZZ'), /Devise/);
  throws(() => formatMinor(1.5, 'CAD', 'fr-CA'), /Montant/);
  const large = formatMinorExact(900719925474099312345n, 'CAD', 'fr-CA');
  strictEqual(large.replace(/\D/g, '').includes('900719925474099312345'), true);
  strictEqual(formatMinorExact(-125n, 'CAD', 'en-CA').includes('1.25'), true);
  strictEqual(currencyCatalog('fr-CA').some(row => row.code === 'JPY' && row.minorDigits === 0), true);
});
test('personal split preference never crosses user or group and expires with membership', async () => {
  const { applicablePreference } = await import('../../src/app/shared/utils/split-preference');
  const preference = { userId: 'a', groupId: 'g1', memberIds: ['a', 'b'], mode: { kind: 'equal' as const, users: ['a', 'b'] } };
  strictEqual(applicablePreference(undefined, 'a', 'g1', new Set(['a', 'b'])), undefined);
  strictEqual(applicablePreference(preference, 'b', 'g1', new Set(['a', 'b'])), undefined);
  strictEqual(applicablePreference(preference, 'a', 'g2', new Set(['a', 'b'])), undefined);
  strictEqual(applicablePreference(preference, 'a', 'g1', new Set(['a'])), undefined);
  deepStrictEqual(applicablePreference(preference, 'a', 'g1', new Set(['a', 'b'])), preference.mode);
});
