import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { locale } from '../../utils/i18n';
import { TranslatePipe } from '@ngx-translate/core';
import { localDateIso, selectedRange, selectionFromRange, type SelectionUnit } from './ui-period-range-model';

export interface UiAppliedRange { readonly start: string; readonly end: string; readonly unit?: SelectionUnit; }

@Component({
  selector: 'app-ui-period-range',
  imports: [TranslatePipe],
  templateUrl: './ui-period-range.html',
})
export class UiPeriodRange {
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @Input() range: UiAppliedRange = { start: localDateIso(new Date()), end: localDateIso(new Date()), unit: 'days' };
  @Output() readonly rangeChange = new EventEmitter<UiAppliedRange>();
  readonly months = Array.from({ length: 12 }, (_, index) => index);
  readonly today = localDateIso(new Date());
  @Input() translationPrefix = 'gallery.period';
  readonly String = String;
  open = false;
  unit: SelectionUnit = 'days';
  first = '';
  last = '';
  awaitingEnd = false;
  cursorMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  cursorYear = new Date().getUTCFullYear();

  @HostListener('document:keydown.escape') onEscape(): void { if (this.open) this.cancel(); }
  @HostListener('document:keydown', ['$event']) onTab(event: Event): void {
    if (!this.open || !this.dialog) return;
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Tab') return;
    const buttons = [...this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (keyboardEvent.shiftKey && (document.activeElement === first || !this.dialog.nativeElement.contains(document.activeElement))) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && (document.activeElement === last || !this.dialog.nativeElement.contains(document.activeElement))) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }
  label(): string {
    const unit = this.range.unit ?? 'days';
    const first = this.format(this.range.start, unit);
    const last = this.format(this.range.end, unit);
    return first === last ? first : `${first} – ${last}`;
  }
  draftRange(): UiAppliedRange | undefined { return selectedRange(this.unit, this.first, this.last || this.first); }
  show(): void {
    ({ unit: this.unit, first: this.first, last: this.last } = selectionFromRange(this.range));
    this.cursorYear = Number(this.first.slice(0, 4));
    this.cursorMonth = new Date(Date.UTC(this.cursorYear, Number(this.first.slice(5, 7)) - 1, 1));
    this.awaitingEnd = false;
    this.open = true;
    setTimeout(() => this.dialog?.nativeElement.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus());
  }
  cancel(): void { this.open = false; setTimeout(() => this.trigger?.nativeElement.focus()); }
  apply(): void {
    const range = this.draftRange();
    if (!range) return;
    this.rangeChange.emit({ ...range, unit: this.unit });
    this.open = false;
    setTimeout(() => this.trigger?.nativeElement.focus());
  }
  selectUnit(unit: SelectionUnit): void {
    const range = this.draftRange() ?? this.range;
    this.unit = unit;
    this.awaitingEnd = false;
    const length = unit === 'days' ? 10 : unit === 'months' ? 7 : 4;
    this.first = range.start.slice(0, length);
    this.last = range.end.slice(0, length);
    this.cursorYear = Number(this.first.slice(0, 4));
    this.cursorMonth = new Date(Date.UTC(this.cursorYear, Number(range.start.slice(5, 7)) - 1, 1));
  }
  select(value: string): void {
    if (this.awaitingEnd) {
      [this.first, this.last] = value < this.first ? [value, this.first] : [this.first, value];
      this.awaitingEnd = false;
    } else {
      this.first = value;
      this.last = value;
      this.awaitingEnd = true;
    }
  }
  inDraft(value: string): boolean { return !!this.first && value >= this.first && value <= (this.last || this.first); }
  moveMonth(delta: number): void { this.cursorMonth = new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + delta, 1)); }
  monthLabel(offset: number): string { return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + offset, 1))); }
  monthLabelShort(index: number): string {
    const date = new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + index, 1));
    return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  weekdays(): string[] { return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, index + 1)))); }
  calendarCells(offset: number): (string | null)[] {
    const year = this.cursorMonth.getUTCFullYear();
    const month = this.cursorMonth.getUTCMonth() + offset;
    const first = new Date(Date.UTC(year, month, 1));
    const blanks = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const prefix = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}`;
    return [...Array<null>(blanks).fill(null), ...Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`)];
  }
  dayNumber(value: string): number { return Number(value.slice(-2)); }
  monthValue(index: number): string {
    const date = new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  yearStart(): number { return Math.floor(this.cursorYear / 12) * 12; }
  yearChoices(): number[] { return Array.from({ length: 12 }, (_, index) => this.yearStart() + index); }
  private format(value: string, unit: SelectionUnit): string {
    const date = new Date(`${value}T00:00:00Z`);
    return new Intl.DateTimeFormat(locale(), unit === 'years' ? { year: 'numeric', timeZone: 'UTC' } : unit === 'months' ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  }
}
