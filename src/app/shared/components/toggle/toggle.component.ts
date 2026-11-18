import { Component, Input, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BinaryControl } from '../binary-control/binary-control';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ToggleComponent), multi: true }],
})
export class ToggleComponent extends BinaryControl {
  @Input({ required: true }) controlId = '';
  @Input({ required: true }) label = '';
  @Input() describedBy = '';
}
