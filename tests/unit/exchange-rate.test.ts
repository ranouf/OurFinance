import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import { convertMinor, convertMinorExact, type ExchangeRateSnapshot } from '../../src/app/shared/utils/exchange-rate';

const rate = (sourceCurrency: string, targetCurrency: string, value: string): ExchangeRateSnapshot =>
  ({ sourceCurrency, targetCurrency, rate: value, date: '2026-11-16', origin: 'manual' });

test('converts 0, 2 and 3 minor-digit currencies with exact half-away rounding', () => {
  strictEqual(convertMinor(101, rate('CAD', 'JPY', '0.5')), 1);
  strictEqual(convertMinor(-101, rate('CAD', 'JPY', '0.5')), -1);
  strictEqual(convertMinor(1, rate('JPY', 'CAD', '0.5')), 50);
  strictEqual(convertMinor(100, rate('CAD', 'KWD', '1.234')), 1234);
  strictEqual(convertMinor(1000, rate('KWD', 'CAD', '1.25')), 125);
  strictEqual(convertMinor(1, rate('CAD', 'JPY', '0.49')), 0);
});

test('keeps large aggregate conversions exact and rejects unsafe persisted amounts', () => {
  const snapshot = rate('CAD', 'USD', '2');
  strictEqual(convertMinorExact(BigInt(Number.MAX_SAFE_INTEGER), snapshot), 2n * BigInt(Number.MAX_SAFE_INTEGER));
  throws(() => convertMinor(Number.MAX_SAFE_INTEGER, snapshot));
  throws(() => convertMinor(Number.MAX_SAFE_INTEGER + 1, snapshot));
});

test('rejects invalid, implicit or imprecise rate snapshots', () => {
  for (const value of ['0', '-1', '1e2', '1,2', '0.0000000000000000001', '1234567890123', '']) {
    throws(() => convertMinor(100, rate('CAD', 'USD', value)));
  }
  throws(() => convertMinor(100, rate('CAD', 'CAD', '1')));
  throws(() => convertMinor(100, { ...rate('CAD', 'USD', '1'), date: '2026-02-30' }));
  throws(() => convertMinor(100, { ...rate('CAD', 'USD', '1'), origin: 'automatic' as 'manual' }));
});
