import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-textarea',
  templateUrl: './textarea.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextareaComponent), multi: true }],
})
export class TextareaComponent implements ControlValueAccessor {
  @Input({ required: true }) controlId = '';
  @Input() placeholder = '';
  @Input() describedBy = '';
  @Input() invalid = false;
  value = '';
  disabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void { this.value = value ?? ''; }
  registerOnChange(callback: (value: string) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  change(event: Event): void { this.value = (event.target as HTMLTextAreaElement).value; this.onChange(this.value); }
  touch(): void { this.onTouched(); }
}
