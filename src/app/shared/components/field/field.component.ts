import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-field',
  templateUrl: './field.component.html',
})
export class FieldComponent {
  @Input({ required: true }) controlId = '';
  @Input({ required: true }) label = '';
  @Input() hint = '';
  @Input() required = false;
}
