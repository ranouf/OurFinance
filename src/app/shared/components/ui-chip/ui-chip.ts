import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ui-chip',
  templateUrl: './ui-chip.html',
})
export class UiChip {
  @Input() selected = false;
  @Input() disabled = false;
  @Output() selectedChange = new EventEmitter<boolean>();
}
