import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-icon-badge',
  template: `<span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-pop-lavender text-pop-primary-dark" aria-hidden="true">
    <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use [attr.href]="'/illustrations/lucide-actions.svg#' + name" /></svg>
  </span>`,
})
export class UiIconBadge {
  @Input({ required: true }) name: 'house' | 'plane' | 'utensils' | 'shopping-cart' | 'tram-front' = 'house';
}
