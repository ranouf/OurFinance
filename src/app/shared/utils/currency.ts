/** Runtime ISO 4217 catalogue supplied by Intl rather than a fixed three-currency union. */
export function currencyCodes(): string[] {
  return Intl.supportedValuesOf('currency');
}
export interface CurrencyDefinition { readonly code: string; readonly name: string; readonly symbol: string; readonly minorDigits: number; }

/** Runtime ICU catalogue; codes stay visible when two currencies share a symbol. */
export function currencyCatalog(locale: string): CurrencyDefinition[] {
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  return currencyCodes().map(code => {
    const format = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
    const digits = format.resolvedOptions().maximumFractionDigits;
    if (digits === undefined) throw new Error('Exposant de devise indisponible');
    return {
      code,
      name: names.of(code) ?? code,
      symbol: format.formatToParts(0).find(part => part.type === 'currency')?.value ?? code,
      minorDigits: digits,
    };
  });
}
export function minorDigits(code: string): number {
  if (!currencyCodes().includes(code)) throw new Error('Devise non prise en charge');
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined) throw new Error('Exposant de devise indisponible');
  return digits;
}
export function formatMinor(amountMinor: number, code: string, locale: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Montant invalide');
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amountMinor / 10 ** minorDigits(code));
}

export function formatMinorExact(amountMinor: bigint, code: string, locale: string): string {
  const digits = minorDigits(code);
  const scale = 10n ** BigInt(digits);
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const decimal = `${amountMinor < 0n ? '-' : ''}${absolute / scale}${digits ? `.${String(absolute % scale).padStart(digits, '0')}` : ''}`;
  // Intl formats decimal strings exactly, including values beyond Number.MAX_SAFE_INTEGER.
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format as unknown as (value: string) => string;
  return format(decimal);
}
