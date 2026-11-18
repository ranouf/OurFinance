import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-icon-badge',
  template: `<span class="flex size-10 shrink-0 items-center justify-center rounded-2xl" [class]="name === 'restaurant' ? 'bg-violet-100 text-violet-600' : name === 'groceries' ? 'bg-rose-100 text-rose-500' : name === 'transport' ? 'bg-sky-100 text-blue-600' : 'bg-pop-peach text-pop-coral'" aria-hidden="true">
    @if (name === 'restaurant' || name === 'groceries' || name === 'transport' || name === 'home') {
      <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><use [attr.href]="'/illustrations/lucide-actions.svg#' + (name === 'restaurant' ? 'utensils' : name === 'groceries' ? 'shopping-cart' : name === 'transport' ? 'tram-front' : 'house')" /></svg>
    } @else { <span class="text-lg">{{ glyph }}</span> }
  </span>`,
})
export class UiIconBadge {
  @Input({ required: true }) name = '';
  @Input() glyph = '';
}
