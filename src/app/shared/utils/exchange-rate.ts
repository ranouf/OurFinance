import { minorDigits } from './currency';

/** One unit of source currency is worth `rate` major units of target currency. */
export interface ExchangeRateSnapshot {
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly rate: string;
  readonly date: string;
  readonly origin: 'manual';
}

const decimal = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,18})?$/;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export function validateExchangeRateSnapshot(snapshot: ExchangeRateSnapshot): void {
  if (!snapshot || snapshot.origin !== 'manual' || snapshot.sourceCurrency === snapshot.targetCurrency ||
      !Intl.supportedValuesOf('currency').includes(snapshot.sourceCurrency) ||
      !Intl.supportedValuesOf('currency').includes(snapshot.targetCurrency) ||
      !validDate(snapshot.date) || !decimal.test(snapshot.rate) ||
      BigInt(snapshot.rate.replace('.', '')) === 0n) throw new Error('Taux de change invalide');
}

/** Converts with integers only; half units are rounded away from zero. */
export function convertMinorExact(sourceMinor: bigint, snapshot: ExchangeRateSnapshot): bigint {
  validateExchangeRateSnapshot(snapshot);
  const fraction = snapshot.rate.split('.')[1] ?? '';
  const numerator = BigInt(snapshot.rate.replace('.', '')) * 10n ** BigInt(minorDigits(snapshot.targetCurrency));
  const denominator = 10n ** BigInt(fraction.length + minorDigits(snapshot.sourceCurrency));
  const absolute = sourceMinor < 0n ? -sourceMinor : sourceMinor;
  const quotient = (absolute * numerator + denominator / 2n) / denominator;
  return sourceMinor < 0n ? -quotient : quotient;
}

/** Safe-integer boundary for a single persisted converted amount. */
export function convertMinor(sourceMinor: number, snapshot: ExchangeRateSnapshot): number {
  if (!Number.isSafeInteger(sourceMinor)) throw new Error('Montant source invalide');
  const result = convertMinorExact(BigInt(sourceMinor), snapshot);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Montant converti hors plage');
  return Number(result);
}
