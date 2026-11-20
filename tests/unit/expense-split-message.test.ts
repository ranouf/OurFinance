import { strictEqual, throws } from 'node:assert';
import { test } from 'node:test';
import { expenseMessage } from '../../src/app/features/expenses/expense-text';
import { language, setLanguage } from '../../src/app/shared/utils/i18n';
import { splitAmount } from '../../src/app/shared/utils/split-engine';

test('an invalid percentage split reports the error in the active language', () => {
  const previous = language();
  try {
    for (const [locale, expected] of [
      ['fr', 'Les pourcentages doivent totaliser 100 %'],
      ['en', 'Percentages must add up to 100%.'],
      ['ja', '割合の合計を100%にしてください。'],
    ] as const) {
      setLanguage(locale);
      throws(() => splitAmount(1001, {
        kind: 'percentage',
        weightsBasisPoints: [{ userId: 'a', value: 4000 }, { userId: 'b', value: 5900 }],
      }), (error: Error) => {
        strictEqual(expenseMessage(error.message), expected);
        return true;
      });
    }
  } finally {
    setLanguage(previous);
  }
});
