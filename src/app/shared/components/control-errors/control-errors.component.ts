import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

const defaultErrorKeys = new Set(['required', 'requiredTrue', 'email', 'min', 'max', 'minlength', 'maxlength', 'pattern']);

@Component({
  selector: 'app-control-errors',
  templateUrl: './control-errors.component.html',
  imports: [TranslatePipe],
})
export class ControlErrorsComponent {
  @Input({ required: true }) errorId = '';
  @Input() control: AbstractControl | null = null;
  @Input() messages: Record<string, string> = {};
  get message(): string | null {
    if (!this.control?.invalid || (!this.control.touched && !this.control.dirty)) return null;
    const key = Object.keys(this.control.errors ?? {})[0];
    return key ? this.messages[key] ?? (defaultErrorKeys.has(key) ? `validation.${key}` : null) : null;
  }
}
