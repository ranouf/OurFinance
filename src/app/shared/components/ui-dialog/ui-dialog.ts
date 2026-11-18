import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({ selector: 'app-ui-dialog', templateUrl: './ui-dialog.html' })
export class UiDialog {
  @Input({ required: true }) title = '';
  @Input() closeLabel = 'Close';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;

  open(): void { this.dialog.nativeElement.showModal(); }
  close(): void { this.dialog.nativeElement.close(); }
  onClose(): void { this.closed.emit(); }
}
