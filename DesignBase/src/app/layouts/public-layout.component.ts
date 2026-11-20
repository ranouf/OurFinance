import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  template: `<div class="app-shell"><main class="main"><div id="route-page"><div class="public-page" [class.login-page]="route === 'login'" [class.join-page]="route === 'join'"><a class="public-brand" href="#dashboard"><span class="brand-mark">↻</span> OurFinance<span class="brand-dot">.</span></a><ng-content /></div></div></main></div>`
})
export class PublicLayoutComponent {
  @Input({ required: true }) route!: string;
}
