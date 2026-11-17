import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-ui-quick-action', templateUrl: './ui-quick-action.html' })
export class UiQuickAction {
  @Input({ required: true }) label = '';
  @Input() kind: 'add' | 'invite' | 'balance' = 'add';
  @Input() disabled = false;
  @Output() activated = new EventEmitter<void>();
}
