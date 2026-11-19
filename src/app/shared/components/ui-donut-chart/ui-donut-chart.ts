import { Component, Input } from '@angular/core';

export interface UiDonutSlice { readonly label: string; readonly percent: number; readonly amount: string; readonly color: string; }

@Component({ selector: 'app-ui-donut-chart', templateUrl: './ui-donut-chart.html' })
export class UiDonutChart {
  @Input() slices: readonly UiDonutSlice[] = [];
  @Input() total = '';
  @Input() totalLabel = '';
  chartBackground(): string {
    let offset = 0;
    const stops = this.slices.map(slice => { const start = offset; offset += slice.percent; return `${slice.color} ${start}% ${offset}%`; });
    return `conic-gradient(${stops.join(', ')})`;
  }
}
