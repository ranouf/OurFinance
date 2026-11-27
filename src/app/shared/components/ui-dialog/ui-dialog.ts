import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({ selector: 'app-ui-dialog', templateUrl: './ui-dialog.html' })
export class UiDialog {
  @Input({ required: true }) title = '';
  @Input() closeLabel = 'Close';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  private pendingNativeCloseEvents = 0;

  open(): void { this.dialog.nativeElement.showModal(); }
  close(): void {
    if (!this.dialog.nativeElement.open) return;
    this.pendingNativeCloseEvents++;
    this.dialog.nativeElement.close();
    this.closed.emit();
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }
  onClose(): void {
    if (this.pendingNativeCloseEvents) { this.pendingNativeCloseEvents--; return; }
    this.closed.emit();
  }
}
