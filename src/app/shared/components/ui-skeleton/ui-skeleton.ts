import { Component, Input } from '@angular/core';

@Component({ selector: 'app-ui-skeleton', templateUrl: './ui-skeleton.html' })
export class UiSkeleton {
  @Input() lines = 2;
  @Input() label = 'Loading';
  lineIndexes(): number[] { return Array.from({ length: this.lines }, (_, index) => index); }
}
