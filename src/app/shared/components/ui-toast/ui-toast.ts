import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-ui-toast',
  templateUrl: './ui-toast.html',
})
export class UiToast {
  @Input() variant: 'success' | 'info' | 'error' = 'info';
  @Input() dismissible = false;
  @Input() closeLabel = 'Close';
  @Output() dismissed = new EventEmitter<void>();
  readonly closed = signal(false);
  close(): void { this.closed.set(true); this.dismissed.emit(); }
}
