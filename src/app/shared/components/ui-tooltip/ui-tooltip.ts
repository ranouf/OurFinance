import { Component, Input } from '@angular/core';

@Component({ selector: 'app-ui-tooltip', templateUrl: './ui-tooltip.html' })
export class UiTooltip {
  @Input({ required: true }) tooltipId = '';
  @Input({ required: true }) text = '';
  @Input({ required: true }) label = '';
}
