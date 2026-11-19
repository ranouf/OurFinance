import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type InputKind = 'text' | 'number' | 'email' | 'tel' | 'password' | 'search' | 'url' | 'date' | 'time';

@Component({
  selector: 'app-input',
  templateUrl: './input.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputComponent), multi: true }],
})
export class InputComponent implements ControlValueAccessor {
  @Input({ required: true }) controlId = '';
  @Input() type: InputKind = 'text';
  @Input() placeholder = '';
  @Input() autocomplete = 'off';
  @Input() describedBy = '';
  @Input() invalid = false;
  @Input() min?: string | number;
  @Input() max?: string | number;
  @Input() step?: string | number;
  @Input() required = false;
  value = '';
  disabled = false;
  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null): void { this.value = value == null ? '' : String(value); }
  registerOnChange(callback: (value: string | number | null) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  change(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.type === 'number' ? (this.value === '' ? null : Number(this.value)) : this.value);
  }
  touch(): void { this.onTouched(); }
}
