import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, inject, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { locale } from '../../utils/i18n';
import { TranslatePipe } from '@ngx-translate/core';
import { BrowserDateTimePipe } from '../../pipes/browser-date-time.pipe';
import { BrowserDateTimeFormat, formatBrowserDateTime } from '../../utils/browser-date-time';
import { localDateIso, selectedRange, selectionFromRange, type SelectionUnit } from './ui-period-range-model';

export interface UiAppliedRange { readonly start: string; readonly end: string; readonly unit?: SelectionUnit; }

@Component({
  selector: 'app-ui-period-range',
  imports: [BrowserDateTimePipe, TranslatePipe],
  templateUrl: './ui-period-range.html',
})
export class UiPeriodRange implements OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @Input() range: UiAppliedRange = { start: localDateIso(new Date()), end: localDateIso(new Date()), unit: 'days' };
  @Output() readonly rangeChange = new EventEmitter<UiAppliedRange>();
  readonly months = Array.from({ length: 12 }, (_, index) => index);
  readonly today = localDateIso(new Date());
  @Input() translationPrefix = 'gallery.period';
  readonly String = String;
  readonly dateFormat = BrowserDateTimeFormat;
  readonly displayLocale = locale;
  open = false;
  unit: SelectionUnit = 'days';
  first = '';
  last = '';
  awaitingEnd = false;
  panelLeft = 0;
  panelTop = 0;
  panelMaxHeight = 0;
  cursorMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  cursorYear = new Date().getUTCFullYear();

  @HostListener('document:keydown.escape') onEscape(): void { if (this.open) this.cancel(); }
  @HostListener('document:pointerdown', ['$event']) onOutsidePointer(event: PointerEvent): void {
    if (this.open && !this.trigger?.nativeElement.contains(event.target as Node) && !this.dialog?.nativeElement.contains(event.target as Node)) this.cancel(false);
  }
  @HostListener('window:resize') onResize(): void { if (this.open) this.positionPanel(); }
  private readonly onScroll = (): void => {
    if (!this.open) return;
    const bounds = this.trigger?.nativeElement.getBoundingClientRect();
    if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) this.cancel(false);
    else this.positionPanel();
  };
  ngOnDestroy(): void { document.removeEventListener('scroll', this.onScroll, true); }
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
    const unit = this.open ? this.unit : this.range.unit ?? 'days';
    const range = this.open ? this.draftRange() : this.range;
    if (!range) return '';
    const first = this.format(range.start, unit);
    const last = this.format(range.end, unit);
    return first === last ? first : `${first} – ${last}`;
  }
  draftRange(): UiAppliedRange | undefined { return selectedRange(this.unit, this.first, this.last || this.first); }
  show(): void {
    ({ unit: this.unit, first: this.first, last: this.last } = selectionFromRange(this.range));
    this.cursorYear = Number(this.first.slice(0, 4));
    this.cursorMonth = new Date(Date.UTC(this.cursorYear, Number(this.first.slice(5, 7)) - 1, 1));
    this.awaitingEnd = false;
    this.trigger?.nativeElement.scrollIntoView({ block: 'start', behavior: 'instant' });
    this.open = true;
    document.addEventListener('scroll', this.onScroll, true);
    setTimeout(() => {
      this.positionPanel();
      this.dialog?.nativeElement.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    });
  }
  cancel(restoreFocus = true): void {
    this.open = false;
    document.removeEventListener('scroll', this.onScroll, true);
    if (restoreFocus) setTimeout(() => this.trigger?.nativeElement.focus());
  }
  apply(): void {
    const range = this.draftRange();
    if (!range) return;
    this.rangeChange.emit({ ...range, unit: this.unit });
    this.cancel();
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
  isBoundary(value: string): boolean { return value === this.first || value === this.last; }
  isInterior(value: string): boolean { return this.inDraft(value) && !this.isBoundary(value); }
  positionPanel(): void {
    const trigger = this.trigger?.nativeElement;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(760, window.innerWidth - 16);
    this.panelLeft = Math.round(Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)));
    this.panelTop = Math.round(rect.bottom + 8);
    this.panelMaxHeight = Math.max(88, Math.round(window.innerHeight - this.panelTop - 8));
    this.changeDetector.detectChanges();
  }
  moveMonth(delta: number): void { this.cursorMonth = new Date(Date.UTC(this.cursorMonth.getUTCFullYear(), this.cursorMonth.getUTCMonth() + delta, 1)); }
  monthDate(offset: number): string { return `${this.monthValue(offset)}-01`; }
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
    return formatBrowserDateTime(value, unit === 'years' ? BrowserDateTimeFormat.Year : unit === 'months' ? BrowserDateTimeFormat.MonthYear : BrowserDateTimeFormat.ShortDate, locale());
  }
}
