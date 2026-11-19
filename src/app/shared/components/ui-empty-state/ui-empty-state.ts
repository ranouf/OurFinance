import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-ui-empty-state', templateUrl: './ui-empty-state.html' })
export class UiEmptyState {
  @Input({ required: true }) message = '';
  @Input() illustrationSrc = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
