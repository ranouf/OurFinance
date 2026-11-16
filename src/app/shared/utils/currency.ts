/** Runtime ISO 4217 catalogue supplied by Intl rather than a fixed three-currency union. */
export function currencyCodes(): string[] {
  return Intl.supportedValuesOf('currency');
}
export function minorDigits(code: string): number {
  if (!currencyCodes().includes(code)) throw new Error('Devise non prise en charge');
  return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
}
export function formatMinor(amountMinor: number, code: string, locale: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Montant invalide');
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amountMinor / 10 ** minorDigits(code));
}
