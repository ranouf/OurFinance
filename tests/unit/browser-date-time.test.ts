import '@angular/compiler';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserDateTimePipe } from '../../src/app/shared/pipes/browser-date-time.pipe';
import { BrowserDateTimeFormat, formatBrowserDateTime } from '../../src/app/shared/utils/browser-date-time';

test('the pipe accepts a display format and browser locale override', () => {
  const pipe = new BrowserDateTimePipe();
  assert.equal(pipe.transform('2026-11-18', BrowserDateTimeFormat.ShortDate, 'fr-CA'), '18 nov. 2026');
  assert.equal(pipe.transform('2026-11-18', BrowserDateTimeFormat.MonthYear, 'en-US'), 'November 2026');
  assert.equal(pipe.transform('2026-11-18', BrowserDateTimeFormat.Year, 'en-US'), '2026');
});

test('a calendar date does not move to the previous day in another time zone', () => {
  assert.equal(formatBrowserDateTime('2026-11-18', BrowserDateTimeFormat.Date, 'en-US', 'America/Los_Angeles'), '11/18/2026');
  assert.equal(formatBrowserDateTime('2026-11-18T02:00:00Z', BrowserDateTimeFormat.Date, 'en-US', 'America/Los_Angeles'), '11/17/2026');
  assert.equal(formatBrowserDateTime('', BrowserDateTimeFormat.Date), '');
  assert.equal(formatBrowserDateTime('invalid', BrowserDateTimeFormat.Date), '');
  assert.equal(formatBrowserDateTime('2026-02-31', BrowserDateTimeFormat.Date), '');
});
