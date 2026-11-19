import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-card',
  templateUrl: './ui-card.html',
})
export class UiCard {
  @Input() label = '';
}
