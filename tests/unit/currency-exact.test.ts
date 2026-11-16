import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { currencyCatalog, formatMinorExact } from '../../src/app/shared/utils/currency';

test('un solde cumulé au-delà des entiers sûrs garde ses unités mineures exactes', () => {
  const amount = 9007199254740993n;
  strictEqual(formatMinorExact(amount, 'CAD', 'fr-CA'), '90 071 992 547 409,93 $');
  strictEqual(formatMinorExact(-amount, 'CAD', 'fr-CA'), '-90 071 992 547 409,93 $');
});

test('catalogue ICU donne nom, symbole et exposant pour CAD, JPY et KWD', () => {
  const catalog = currencyCatalog('fr-CA');
  strictEqual(catalog.length > 150, true);
  for (const [code, digits] of [['CAD', 2], ['JPY', 0], ['KWD', 3]] as const) {
    const currency = catalog.find(item => item.code === code);
    strictEqual(currency?.minorDigits, digits);
    strictEqual((currency?.name.length ?? 0) > 0, true);
    strictEqual((currency?.symbol.length ?? 0) > 0, true);
  }
});
