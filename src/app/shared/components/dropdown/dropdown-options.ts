import type { CurrencyDefinition } from '../../utils/currency';
import type { DropdownOption } from './dropdown.component';

/** Build the same accessible choices for group selectors across business pages. */
export function groupDropdownOptions<T extends { readonly id: string; readonly name: string; readonly currency?: string }>(
  groups: readonly T[],
  placeholder?: string,
  showCurrency = false,
): DropdownOption[] {
  const choices: DropdownOption[] = groups.map((group, index) => ({
    value: group.id,
    label: showCurrency && group.currency ? `${group.name} · ${group.currency}` : group.name,
    iconName: 'house',
    tone: index % 2 ? 'sky' : 'violet',
  }));
  return placeholder === undefined ? choices : [{ value: '', label: placeholder }, ...choices];
}

const currencyFlags: Readonly<Record<string, string>> = {
  AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', EUR: '🇪🇺', GBP: '🇬🇧',
  INR: '🇮🇳', JPY: '🇯🇵', MXN: '🇲🇽', NZD: '🇳🇿', SEK: '🇸🇪', USD: '🇺🇸',
};

export function currencyDropdownOptions(currencies: readonly CurrencyDefinition[], detailed = false): DropdownOption[] {
  return currencies.map(currency => ({
    value: currency.code,
    label: detailed
      ? `${currency.code} · ${currency.name} (${currency.symbol}, ${currency.minorDigits})`
      : `${currency.code} · ${currency.name}`,
    flag: currencyFlags[currency.code],
  }));
}
