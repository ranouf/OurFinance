import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface UiTab { readonly value: string; readonly label: string; }

@Component({ selector: 'app-ui-tabs', templateUrl: './ui-tabs.html' })
export class UiTabs {
  @Input() tabs: readonly UiTab[] = [];
  @Input() active = '';
  @Output() activeChange = new EventEmitter<string>();

  select(value: string): void { this.active = value; this.activeChange.emit(value); }

  onKeydown(event: KeyboardEvent, index: number): void {
    const next = event.key === 'ArrowRight' ? (index + 1) % this.tabs.length :
      event.key === 'ArrowLeft' ? (index - 1 + this.tabs.length) % this.tabs.length :
      event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.select(this.tabs[next].value);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
}
