import { Component, Input } from '@angular/core';
import { UiIconBadge, type UiIconTone } from '../ui-icon-badge/ui-icon-badge';

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
  @Input() iconTone: UiIconTone = 'violet';
  @Input() amountTone: 'positive' | 'negative' | 'neutral' = 'neutral';
  @Input() selected = false;
}
