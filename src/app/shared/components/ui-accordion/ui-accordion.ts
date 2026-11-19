import { Component, Input } from '@angular/core';

@Component({ selector: 'app-ui-accordion', templateUrl: './ui-accordion.html' })
export class UiAccordion {
  @Input({ required: true }) title = '';
  @Input() expanded = false;
}
