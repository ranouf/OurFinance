import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { selectedRange, type SelectionUnit } from './period-range';

export interface AppliedRange { readonly start: string; readonly end: string; readonly unit?: SelectionUnit; }

@Component({
  selector: 'app-period-picker',
  template: `
    <div class="mt-4">
      <span class="block text-sm font-medium">Période</span>
      <button #trigger class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" type="button" [attr.aria-expanded]="open" (click)="show()">
        {{ label() }} <span class="float-right" aria-hidden="true">▾</span>
      </button>
    </div>
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="presentation">
        <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-label="Choisir une période">
          <div class="flex items-start justify-between gap-3">
            <div><h3 class="text-lg font-semibold">Choisir une période</h3><p class="mt-1 text-sm text-slate-600">Sélectionnez le début puis la fin, bornes incluses.</p></div>
            <button class="rounded-lg border border-slate-300 px-3 py-2 focus-visible:ring-2 focus-visible:ring-teal-700" type="button" aria-label="Fermer le sélecteur" (click)="cancel()">✕</button>
          </div>
          <div class="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Unité de période">
            <button class="rounded-lg px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" role="tab" data-period-tab [attr.aria-selected]="unit === 'days'" [class.bg-teal-700]="unit === 'days'" [class.text-white]="unit === 'days'" [class.border]="unit !== 'days'" (click)="selectUnit('days')">Jours</button>
            <button class="rounded-lg px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" role="tab" [attr.aria-selected]="unit === 'months'" [class.bg-teal-700]="unit === 'months'" [class.text-white]="unit === 'months'" [class.border]="unit !== 'months'" (click)="selectUnit('months')">Mois</button>
            <button class="rounded-lg px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" role="tab" [attr.aria-selected]="unit === 'years'" [class.bg-teal-700]="unit === 'years'" [class.text-white]="unit === 'years'" [class.border]="unit !== 'years'" (click)="selectUnit('years')">Années</button>
          </div>
          <p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">{{ draftLabel() }}</p>
          @if (unit === 'days') {
            <div class="mt-4 flex items-center justify-between gap-3">
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Mois précédents" (click)="moveMonth(-1)">←</button>
              <span class="text-center text-sm font-medium">{{ monthLabel(0) }} – {{ monthLabel(1) }}</span>
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Mois suivants" (click)="moveMonth(1)">→</button>
            </div>
            <div class="mt-3 grid gap-4 md:grid-cols-2">
              @for (offset of [0, 1]; track offset) {
                <div>
                  <h4 class="text-center text-sm font-semibold">{{ monthLabel(offset) }}</h4>
                  <div class="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                    @for (day of ['L', 'M', 'M', 'J', 'V', 'S', 'D']; track $index) { <span>{{ day }}</span> }
                  </div>
                  <div class="mt-1 grid grid-cols-7 gap-1">
                    @for (date of calendarCells(offset); track $index) {
                      @if (date) {
                        <button class="min-h-9 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" [class.bg-teal-700]="inDraft(date)" [class.text-white]="inDraft(date)" [attr.aria-pressed]="inDraft(date)" [attr.aria-label]="date" (click)="select(date)">{{ dayNumber(date) }}</button>
                      } @else { <span></span> }
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (unit === 'months') {
            <div class="mt-4 flex items-center justify-between">
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Année précédente" (click)="cursorYear = cursorYear - 1">←</button>
              <span class="font-semibold">{{ cursorYear }}</span>
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Année suivante" (click)="cursorYear = cursorYear + 1">→</button>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              @for (month of months; track $index) {
                <button class="min-h-11 rounded-lg border border-slate-200 px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" [class.bg-teal-700]="inDraft(monthValue($index))" [class.text-white]="inDraft(monthValue($index))" [attr.aria-pressed]="inDraft(monthValue($index))" (click)="select(monthValue($index))">{{ month }}</button>
              }
            </div>
          } @else {
            <div class="mt-4 flex items-center justify-between">
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Années précédentes" (click)="cursorYear = cursorYear - 12">←</button>
              <span class="font-semibold">{{ yearStart() }} – {{ yearStart() + 11 }}</span>
              <button class="rounded-lg border border-slate-300 px-3 py-2" type="button" aria-label="Années suivantes" (click)="cursorYear = cursorYear + 12">→</button>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              @for (year of yearChoices(); track year) {
                <button class="min-h-11 rounded-lg border border-slate-200 p-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700" type="button" [class.bg-teal-700]="inDraft(String(year))" [class.text-white]="inDraft(String(year))" [attr.aria-pressed]="inDraft(String(year))" (click)="select(String(year))">{{ year }}</button>
              }
            </div>
          }
          <div class="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button class="rounded-lg border border-slate-300 px-4 py-2" type="button" (click)="cancel()">Annuler</button>
            <button class="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50" type="button" [disabled]="!draftRange()" (click)="apply()">Appliquer</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PeriodPicker {
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @Input({ required: true }) range!: AppliedRange;
  @Output() readonly rangeChange = new EventEmitter<AppliedRange>();
  readonly months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  readonly String = String;
  open = false;
  unit: SelectionUnit = 'months';
  appliedUnit: SelectionUnit = 'months';
  first = '';
  last = '';
  cursorMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  cursorYear = new Date().getUTCFullYear();

  @HostListener('document:keydown.escape') onEscape(): void { if (this.open) this.cancel(); }
  label(): string { return `${this.format(this.range.start)} – ${this.format(this.range.end)}`; }
  draftLabel(): string { return this.first ? `${this.first} – ${this.last || '…'}` : 'Choisissez une première borne.'; }
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
  monthLabel(offset: number): string { return new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + offset, 1))); }
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
  private format(value: string): string { return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
}
