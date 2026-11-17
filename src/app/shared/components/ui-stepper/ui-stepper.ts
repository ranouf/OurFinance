import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-ui-stepper', templateUrl: './ui-stepper.html' })
export class UiStepper {
  @Input() value = 1;
  @Input() min = 0;
  @Input() max = 99;
  @Input() decreaseLabel = 'Decrease';
  @Input() increaseLabel = 'Increase';
  @Output() valueChange = new EventEmitter<number>();
  change(delta: number): void { this.value = Math.min(this.max, Math.max(this.min, this.value + delta)); this.valueChange.emit(this.value); }
}
