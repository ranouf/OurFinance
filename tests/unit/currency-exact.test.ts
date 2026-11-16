import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { formatMinorExact } from '../../src/app/shared/utils/currency';

test('un solde cumulé au-delà des entiers sûrs garde ses unités mineures exactes', () => {
  const amount = 9007199254740993n;
  strictEqual(formatMinorExact(amount, 'CAD', 'fr-CA'), '90 071 992 547 409,93 $');
  strictEqual(formatMinorExact(-amount, 'CAD', 'fr-CA'), '-90 071 992 547 409,93 $');
});
