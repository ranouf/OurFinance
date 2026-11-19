import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-badge',
  templateUrl: './ui-badge.html',
})
export class UiBadge {
  @Input() tone: 'neutral' | 'positive' | 'negative' = 'neutral';
}
