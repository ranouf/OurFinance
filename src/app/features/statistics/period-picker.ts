import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { locale } from '../../shared/utils/i18n';
import { selectedRange, type SelectionUnit } from './period-range';
import { statisticsText } from './statistics-text';

export interface AppliedRange { readonly start: string; readonly end: string; readonly unit?: SelectionUnit; }

@Component({
  selector: 'app-period-picker',
  template: `
    <div class="mt-4">
      <span class="block text-sm font-bold">{{ text('period') }}</span>
      <button #trigger class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-expanded]="open" (click)="show()">
        {{ label() }} <span class="float-right" aria-hidden="true">▾</span>
      </button>
    </div>
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-pop-text/50 p-3 sm:p-6" role="presentation">
        <div #dialog class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-pop-surface p-4 text-pop-text shadow-xl sm:p-6" role="dialog" aria-modal="true" [attr.aria-label]="text('choosePeriod')">
          <div class="flex items-start justify-between gap-3">
            <div><h3 class="text-lg font-extrabold">{{ text('choosePeriod') }}</h3><p class="mt-1 text-sm text-pop-muted">{{ text('periodIntro') }}</p></div>
            <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2 focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-label]="text('close')" (click)="cancel()">✕</button>
          </div>
          <div class="mt-5 grid grid-cols-3 gap-2" role="tablist" [attr.aria-label]="text('units')">
            <button class="min-h-11 rounded-xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" role="tab" data-period-tab [attr.aria-selected]="unit === 'days'" [class.bg-pop-primary]="unit === 'days'" [class.text-white]="unit === 'days'" [class.border]="unit !== 'days'" (click)="selectUnit('days')">{{ text('days') }}</button>
            <button class="min-h-11 rounded-xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" role="tab" [attr.aria-selected]="unit === 'months'" [class.bg-pop-primary]="unit === 'months'" [class.text-white]="unit === 'months'" [class.border]="unit !== 'months'" (click)="selectUnit('months')">{{ text('months') }}</button>
            <button class="min-h-11 rounded-xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" role="tab" [attr.aria-selected]="unit === 'years'" [class.bg-pop-primary]="unit === 'years'" [class.text-white]="unit === 'years'" [class.border]="unit !== 'years'" (click)="selectUnit('years')">{{ text('years') }}</button>
          </div>
          <p class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm" aria-live="polite">{{ draftLabel() }}</p>
          @if (unit === 'days') {
            <div class="mt-4 flex items-center justify-between gap-3">
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('previousMonths')" (click)="moveMonth(-1)">←</button>
              <span class="text-center text-sm font-medium">{{ monthLabel(0) }} – {{ monthLabel(1) }}</span>
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('nextMonths')" (click)="moveMonth(1)">→</button>
            </div>
            <div class="mt-3 grid gap-4 md:grid-cols-2">
              @for (offset of [0, 1]; track offset) {
                <div>
                  <h4 class="text-center text-sm font-semibold">{{ monthLabel(offset) }}</h4>
                  <div class="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-pop-muted">
                    @for (day of weekdays(); track $index) { <span>{{ day }}</span> }
                  </div>
                  <div class="mt-1 grid grid-cols-7 gap-1">
                    @for (date of calendarCells(offset); track $index) {
                      @if (date) {
                        <button class="min-h-11 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [class.bg-pop-primary]="inDraft(date)" [class.text-white]="inDraft(date)" [attr.aria-pressed]="inDraft(date)" [attr.aria-label]="date" (click)="select(date)">{{ dayNumber(date) }}</button>
                      } @else { <span></span> }
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (unit === 'months') {
            <div class="mt-4 flex items-center justify-between">
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('previousYear')" (click)="cursorYear = cursorYear - 1">←</button>
              <span class="font-semibold">{{ cursorYear }}</span>
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('nextYear')" (click)="cursorYear = cursorYear + 1">→</button>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              @for (month of months; track $index) {
                <button class="min-h-11 rounded-xl border border-pop-border px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [class.bg-pop-primary]="inDraft(monthValue($index))" [class.text-white]="inDraft(monthValue($index))" [attr.aria-pressed]="inDraft(monthValue($index))" (click)="select(monthValue($index))">{{ monthLabelShort($index) }}</button>
              }
            </div>
          } @else {
            <div class="mt-4 flex items-center justify-between">
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('previousYears')" (click)="cursorYear = cursorYear - 12">←</button>
              <span class="font-semibold">{{ yearStart() }} – {{ yearStart() + 11 }}</span>
              <button class="min-h-11 rounded-xl border border-pop-border px-3 py-2" type="button" [attr.aria-label]="text('nextYears')" (click)="cursorYear = cursorYear + 12">→</button>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              @for (year of yearChoices(); track year) {
                <button class="min-h-11 rounded-xl border border-pop-border p-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [class.bg-pop-primary]="inDraft(String(year))" [class.text-white]="inDraft(String(year))" [attr.aria-pressed]="inDraft(String(year))" (click)="select(String(year))">{{ year }}</button>
              }
            </div>
          }
          <div class="mt-6 flex justify-end gap-2 border-t border-pop-border pt-4">
            <button class="min-h-11 rounded-xl border border-pop-border px-4 py-2" type="button" (click)="cancel()">{{ text('cancel') }}</button>
            <button class="min-h-11 rounded-xl bg-pop-primary px-4 py-2 font-bold text-white disabled:opacity-50" type="button" [disabled]="!draftRange()" (click)="apply()">{{ text('apply') }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PeriodPicker {
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @Input({ required: true }) range!: AppliedRange;
  @Output() readonly rangeChange = new EventEmitter<AppliedRange>();
  readonly months = Array.from({ length: 12 }, (_, index) => index);
  readonly text = statisticsText;
  readonly String = String;
  open = false;
  unit: SelectionUnit = 'months';
  appliedUnit: SelectionUnit = 'months';
  first = '';
  last = '';
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
  label(): string { return `${this.format(this.range.start)} – ${this.format(this.range.end)}`; }
  draftLabel(): string { return this.first ? `${this.first} – ${this.last || '…'}` : this.text('firstBound'); }
  draftRange(): AppliedRange | undefined { return selectedRange(this.unit, this.first, this.last); }
  show(): void {
    this.unit = this.appliedUnit;
    const length = this.unit === 'days' ? 10 : this.unit === 'months' ? 7 : 4;
    this.first = this.range.start.slice(0, length);
    this.last = this.range.end.slice(0, length);
    this.cursorYear = Number(this.first.slice(0, 4));
    this.cursorMonth = new Date(Date.UTC(this.cursorYear, Number(this.first.slice(5, 7)) - 1, 1));
    this.open = true;
    setTimeout(() => document.querySelector<HTMLButtonElement>('[data-period-tab]')?.focus());
  }
  cancel(): void { this.open = false; setTimeout(() => this.trigger?.nativeElement.focus()); }
  apply(): void {
    const range = this.draftRange();
    if (!range) return;
    this.appliedUnit = this.unit;
    this.rangeChange.emit({ ...range, unit: this.unit });
    this.open = false;
    setTimeout(() => this.trigger?.nativeElement.focus());
  }
  selectUnit(unit: SelectionUnit): void {
    const range = this.draftRange() ?? this.range;
    this.unit = unit;
    const length = unit === 'days' ? 10 : unit === 'months' ? 7 : 4;
    this.first = range.start.slice(0, length);
    this.last = range.end.slice(0, length);
    this.cursorYear = Number(this.first.slice(0, 4));
    this.cursorMonth = new Date(Date.UTC(this.cursorYear, Number(range.start.slice(5, 7)) - 1, 1));
  }
  select(value: string): void {
    if (!this.first || this.last) { this.first = value; this.last = ''; }
    else if (value < this.first) { this.last = this.first; this.first = value; }
    else this.last = value;
  }
  inDraft(value: string): boolean { return !!this.first && value >= this.first && value <= (this.last || this.first); }
  moveMonth(delta: number): void { this.cursorMonth = new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + delta, 1)); }
  monthLabel(offset: number): string { return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + offset, 1))); }
  monthLabelShort(index: number): string { return new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))); }
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
  monthValue(index: number): string { return `${this.cursorYear}-${String(index + 1).padStart(2, '0')}`; }
  yearStart(): number { return Math.floor(this.cursorYear / 12) * 12; }
  yearChoices(): number[] { return Array.from({ length: 12 }, (_, index) => this.yearStart() + index); }
  private format(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
}
