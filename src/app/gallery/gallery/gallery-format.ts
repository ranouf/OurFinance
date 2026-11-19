import { formatMinor } from '../../shared/utils/currency';
import { locale } from '../../shared/utils/i18n';

export function galleryAmount(amountMinor: number): string {
  return formatMinor(amountMinor, 'CAD', locale());
}

export function galleryDate(day: number): string {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 10, day)));
}
