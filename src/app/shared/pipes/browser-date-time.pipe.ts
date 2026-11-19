import { Pipe, PipeTransform } from '@angular/core';
import { BrowserDateTimeFormat, formatBrowserDateTime } from '../utils/browser-date-time';

/** `value | browserDateTime: format : locale? : timeZone?`; defaults to browser languages. */
@Pipe({ name: 'browserDateTime' })
export class BrowserDateTimePipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    format: BrowserDateTimeFormat = BrowserDateTimeFormat.DateTime,
    locale?: string | readonly string[],
    timeZone?: string,
  ): string {
    return formatBrowserDateTime(value, format, locale, timeZone);
  }
}
