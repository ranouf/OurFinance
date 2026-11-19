import { ControlValueAccessor } from '@angular/forms';

export abstract class BinaryControl implements ControlValueAccessor {
  checked = false;
  disabled = false;
  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: boolean | null): void { this.checked = !!value; }
  registerOnChange(callback: (value: boolean) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  change(event: Event): void {
    this.checked = (event.target as HTMLInputElement).checked;
    this.onChange(this.checked);
  }
  touch(): void { this.onTouched(); }
}
