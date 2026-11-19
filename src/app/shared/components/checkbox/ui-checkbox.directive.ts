import { Directive } from '@angular/core';

/** Keeps native checkbox form bindings while sharing the UI kit's focus and accent. */
@Directive({
  selector: 'input[type=checkbox][appUiCheckbox]',
  host: { class: 'size-5 shrink-0 accent-pop-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pop-primary-dark' },
})
export class UiCheckboxDirective {}
