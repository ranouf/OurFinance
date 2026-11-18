import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-group-card',
  templateUrl: './ui-group-card.html',
})
export class UiGroupCard {
  @Input({ required: true }) name = '';
  @Input() detail = '';
  @Input() amount = '';
  @Input() iconSrc = '';
  @Input() amountTone: 'positive' | 'negative' | 'neutral' = 'neutral';
  @Input() selected = false;
}
