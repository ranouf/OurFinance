import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-field',
  templateUrl: './ui-field.html',
})
export class UiField {
  @Input({ required: true }) controlId = '';
  @Input({ required: true }) label = '';
  @Input() hint = '';
  @Input() error = '';
}
