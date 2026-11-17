import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-ui-alert',
  templateUrl: './ui-alert.html',
})
export class UiAlert {
  @Input() variant: 'error' | 'warning' | 'success' | 'info' = 'info';
  @Input() title = '';
  @Input() icon = true;
  @Input() dismissible = false;
  @Input() closeLabel = 'Close';
  @Output() dismissed = new EventEmitter<void>();
  readonly closed = signal(false);

  close(): void {
    this.closed.set(true);
    this.dismissed.emit();
  }
}
