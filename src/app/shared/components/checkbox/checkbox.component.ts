import { Component, Input, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BinaryControl } from '../binary-control/binary-control';

@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CheckboxComponent), multi: true }],
})
export class CheckboxComponent extends BinaryControl {
  @Input({ required: true }) controlId = '';
  @Input({ required: true }) label = '';
  @Input() describedBy = '';
  @Input() invalid = false;
}
