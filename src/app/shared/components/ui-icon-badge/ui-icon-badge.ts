import { Component, Input } from '@angular/core';

export type UiIconTone = 'violet' | 'coral' | 'mint' | 'sky' | 'amber';

@Component({
  selector: 'app-ui-icon-badge',
  template: `<span class="flex size-10 shrink-0 items-center justify-center rounded-2xl" [class.bg-pop-lavender]="tone === 'violet'" [class.text-pop-primary-dark]="tone === 'violet'" [class.bg-rose-100]="tone === 'coral'" [class.text-rose-700]="tone === 'coral'" [class.bg-emerald-100]="tone === 'mint'" [class.text-emerald-700]="tone === 'mint'" [class.bg-sky-100]="tone === 'sky'" [class.text-sky-700]="tone === 'sky'" [class.bg-amber-100]="tone === 'amber'" [class.text-amber-800]="tone === 'amber'" aria-hidden="true">
    <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use [attr.href]="'/illustrations/lucide-actions.svg#' + name" /></svg>
  </span>`,
})
export class UiIconBadge {
  @Input({ required: true }) name: 'house' | 'plane' | 'utensils' | 'shopping-cart' | 'tram-front' | 'graduation-cap' | 'heart-pulse' | 'ticket' | 'gift' | 'wrench' | 'map-pin' = 'house';
  @Input() tone: UiIconTone = 'violet';
}
