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

const currenciesWithFlags = new Set('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XCG YER ZAR ZMW ZWG ZWL'.split(' '));

export function currencyDropdownOptions(currencies: readonly CurrencyDefinition[], detailed = false): DropdownOption[] {
  return currencies.map(currency => ({
    value: currency.code,
    label: detailed
      ? `${currency.code} · ${currency.name} (${currency.symbol}, ${currency.minorDigits})`
      : `${currency.code} · ${currency.name}`,
    iconSrc: currenciesWithFlags.has(currency.code)
      ? '/flags/' + (['ANG', 'XCG'].includes(currency.code) ? 'cw' : currency.code.slice(0, 2).toLowerCase()) + '.svg'
      : undefined,
  }));
}
