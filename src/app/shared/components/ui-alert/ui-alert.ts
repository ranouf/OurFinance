import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-alert',
  templateUrl: './ui-alert.html',
})
export class UiAlert {
  @Input() variant: 'error' | 'success' | 'info' = 'info';
}
