import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-button',
  host: { class: 'inline-flex align-middle' },
  templateUrl: './ui-button.html',
})
export class UiButton {
  @Input() variant: 'primary' | 'coral' | 'secondary' | 'outline' | 'ghost' | 'danger' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() block = false;
}
