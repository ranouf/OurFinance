import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({ selector: 'app-ui-dialog', templateUrl: './ui-dialog.html' })
export class UiDialog {
  @Input({ required: true }) title = '';
  @Input() closeLabel = 'Close';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  private pendingProgrammaticCloseEvents = 0;

  open(): void { this.dialog.nativeElement.showModal(); }
  close(): void {
    if (!this.dialog.nativeElement.open) return;
    this.pendingProgrammaticCloseEvents++;
    this.dialog.nativeElement.close();
    this.closed.emit();
  }
  onClose(): void {
    if (this.pendingProgrammaticCloseEvents) { this.pendingProgrammaticCloseEvents--; return; }
    // Escape can also queue a close event that arrives after a new open.
    if (!this.dialog.nativeElement.open) this.closed.emit();
  }
}
