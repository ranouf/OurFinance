import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { locale } from '../../utils/i18n';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CalendarComponent), multi: true }],
})
export class CalendarComponent implements ControlValueAccessor {
  @Input({ required: true }) label = '';
  @Input() min = '';
  @Input() max = '';
  readonly locale = locale;
  year = new Date().getFullYear();
  month = new Date().getMonth();
  selected = '';
  disabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get monthLabel(): string { return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(this.year, this.month, 1)); }
  get weekdays(): string[] {
    const format = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(2024, 0, 1 + index)));
  }
  get leadingDays(): number[] { return Array.from({ length: (new Date(this.year, this.month, 1).getDay() + 6) % 7 }, (_, index) => index); }
  get days(): number[] { return Array.from({ length: new Date(this.year, this.month + 1, 0).getDate() }, (_, index) => index + 1); }
  get previousLabel(): string { return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(this.year, this.month - 1, 1)); }
  get nextLabel(): string { return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(this.year, this.month + 1, 1)); }
  date(day: number): string { return `${this.year}-${String(this.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
  dayLabel(day: number): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'full' }).format(new Date(this.year, this.month, day)); }
  available(day: number): boolean { const value = this.date(day); return !this.disabled && (!this.min || value >= this.min) && (!this.max || value <= this.max); }
  move(offset: number): void { const date = new Date(this.year, this.month + offset, 1); this.year = date.getFullYear(); this.month = date.getMonth(); }
  select(day: number): void { if (!this.available(day)) return; this.selected = this.date(day); this.onChange(this.selected); this.onTouched(); }
  writeValue(value: string | null): void {
    this.selected = value ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.selected)) { const [year, month] = this.selected.split('-').map(Number); this.year = year; this.month = month - 1; }
  }
  registerOnChange(callback: (value: string) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
}
