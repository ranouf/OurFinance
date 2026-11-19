import { Component, Input } from '@angular/core';
import { UiIconBadge } from '../ui-icon-badge/ui-icon-badge';

@Component({
  selector: 'app-ui-group-card',
  imports: [UiIconBadge],
  templateUrl: './ui-group-card.html',
})
export class UiGroupCard {
  @Input({ required: true }) name = '';
  @Input() detail = '';
  @Input() amount = '';
  @Input() icon: 'house' | 'plane' = 'house';
  @Input() amountTone: 'positive' | 'negative' | 'neutral' = 'neutral';
  @Input() selected = false;
}
