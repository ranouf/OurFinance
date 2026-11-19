import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-ui-success-state',
  templateUrl: './ui-success-state.html',
})
export class UiSuccessState {
  @Input({ required: true }) title = '';
  @Input() message = '';
  @Input() closeLabel = 'Close';
  @Input() dismissible = false;
  @Output() dismissed = new EventEmitter<void>();
  readonly closed = signal(false);

  close(): void {
    this.closed.set(true);
    this.dismissed.emit();
  }
}
