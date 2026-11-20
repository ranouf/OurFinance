import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { t } from '../../utils/i18n';

@Component({
  selector: 'app-nav-icon',
  template: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    @switch (name) {
      @case ('home') { <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /> }
      @case ('groups') { <circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2zM17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1" /> }
      @case ('expenses') { <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /> }
      @case ('statistics') { <path d="M3 21h18M5 17h3v4H5zM11 11h3v10h-3zM17 5h3v16h-3z" /> }
      @case ('account') { <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /> }
    }
  </svg>`,
})
class NavIcon { @Input({ required: true }) name = ''; }

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, NavIcon],
  template: `
    <div class="min-h-screen bg-pop-background text-pop-text">
      @if (signedIn) {
        <aside class="fixed inset-y-0 left-0 z-20 hidden w-56 overflow-hidden border-r border-pop-border bg-white px-4 py-7 lg:flex lg:flex-col" [attr.aria-label]="t('navLabel')">
          <a class="mb-10 flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/dashboard">
            <img src="/illustrations/ourfinance-mark.svg" width="40" height="40" alt="" />
            <span class="text-lg font-black tracking-tight text-pop-primary-dark">ourfinance.</span>
          </a>
          <nav class="space-y-2" [attr.aria-label]="t('navLabel')">
            <a class="pop-nav-link" routerLink="/dashboard" routerLinkActive="pop-nav-active"><app-nav-icon name="home" />{{ t('navHome') }}</a>
            <a class="pop-nav-link" routerLink="/groups" routerLinkActive="pop-nav-active"><app-nav-icon name="groups" />{{ t('navGroups') }}</a>
            <a class="pop-nav-link" routerLink="/expenses" routerLinkActive="pop-nav-active"><app-nav-icon name="expenses" />{{ t('navExpenses') }}</a>
            <a class="pop-nav-link" routerLink="/statistics" routerLinkActive="pop-nav-active"><app-nav-icon name="statistics" />{{ t('navStatistics') }}</a>
            <a class="pop-nav-link" routerLink="/account" routerLinkActive="pop-nav-active"><app-nav-icon name="account" />{{ t('navAccount') }}</a>
          </nav>
          <div class="mt-auto h-36" aria-hidden="true"></div>
          <img class="pointer-events-none absolute bottom-0 left-0 w-56" src="/illustrations/sidebar-paris-cafe.webp" alt="" />
        </aside>
      }
      <div [class.lg:pl-56]="signedIn">
        @if (signedIn) {
          <header class="relative z-40 bg-white/90">
            <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-7 lg:px-8">
              <a class="flex items-center gap-1.5 lg:hidden" routerLink="/dashboard"><img src="/illustrations/ourfinance-mark.svg" width="34" height="34" alt="" /><strong class="text-base font-black text-pop-primary-dark">ourfinance.</strong></a>
              <span class="hidden font-black text-pop-primary-dark lg:block">{{ pageTitle }}</span>
              <details #profileMenu class="relative group">
                <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl px-1 focus-visible:outline-2 focus-visible:outline-pop-primary [&::-webkit-details-marker]:hidden">
                  <span class="sr-only">{{ t('navAccount') }}</span>
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-pop-coral font-black text-white" aria-hidden="true">{{ userInitial }}</span><span class="hidden max-w-40 truncate text-sm font-bold sm:inline">{{ userName }}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden size-4 shrink-0 self-center text-pop-primary-dark sm:block"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div class="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-pop-border bg-white p-2 shadow-xl">
                  <a class="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-pop-lavender focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/account">{{ t('preferences') }}</a>
                  <button class="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-pop-lavender focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="signOut.emit()">{{ t('logout') }}</button>
                </div>
              </details>
            </div>
          </header>
        }
        <main class="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8" [class.pb-28]="signedIn" [class.lg:px-8]="signedIn"><ng-content /></main>
      </div>
      @if (signedIn) {
        <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-pop-border bg-white px-2 pt-1.5 pb-[calc(.4rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_#30275212] lg:hidden" [attr.aria-label]="t('navLabel')">
          <div class="mx-auto grid max-w-lg grid-cols-5 gap-1">
            <a class="pop-bottom-link" routerLink="/dashboard" routerLinkActive="pop-bottom-active"><app-nav-icon name="home" />{{ t('navHome') }}</a>
            <a class="pop-bottom-link" routerLink="/groups" routerLinkActive="pop-bottom-active"><app-nav-icon name="groups" />{{ t('navGroups') }}</a>
            <a class="pop-bottom-link" [routerLink]="hasGroups ? '/expenses' : '/groups'" routerLinkActive="pop-bottom-active" [attr.aria-label]="hasGroups ? t('navAdd') : t('createGroup')"><span class="flex h-11 w-11 items-center justify-center rounded-full bg-pop-coral text-2xl text-white shadow-md" aria-hidden="true">＋</span></a>
            <a class="pop-bottom-link" routerLink="/statistics" routerLinkActive="pop-bottom-active"><app-nav-icon name="statistics" />{{ t('navStatistics') }}</a>
            <a class="pop-bottom-link" routerLink="/account" routerLinkActive="pop-bottom-active"><app-nav-icon name="account" />{{ t('navAccount') }}</a>
          </div>
        </nav>
      }
    </div>
  `,
  styles: [`
    .pop-nav-link { display:flex; align-items:center; gap:.75rem; min-height:2.75rem; border-radius:.75rem; padding:0 .75rem; color:var(--color-pop-text); font-weight:750; font-size:.9rem; }
    .pop-nav-link:hover, .pop-nav-link:focus-visible, .pop-nav-active { background:var(--color-pop-lavender); color:var(--color-pop-primary-dark); }
    .pop-nav-link app-nav-icon { display:flex; width:1.35rem; justify-content:center; }
    .pop-bottom-link { display:flex; min-height:3.35rem; flex-direction:column; align-items:center; justify-content:center; gap:.1rem; border-radius:.7rem; color:var(--color-pop-muted); font-size:.62rem; font-weight:750; text-align:center; }
    .pop-bottom-link app-nav-icon { display:flex; }
    .pop-bottom-active { color:var(--color-pop-primary-dark); }
    .pop-bottom-link:focus-visible { outline:2px solid var(--color-pop-primary); outline-offset:2px; }
  `],
})
export class AppShell {
  @Input() signedIn = false;
  @Input() hasGroups = false;
  @Input() userInitial = '?';
  @Input() userName = '';
  @Input() pageTitle = '';
  @Output() signOut = new EventEmitter<void>();
  @ViewChild('profileMenu') profileMenu?: ElementRef<HTMLDetailsElement>;
  readonly t = t;
  @HostListener('document:click', ['$event']) closeMenuOutside(event: MouseEvent): void {
    const menu = this.profileMenu?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) menu.open = false;
  }
  @HostListener('document:keydown.escape') closeMenuOnEscape(): void {
    if (this.profileMenu?.nativeElement) this.profileMenu.nativeElement.open = false;
  }
}
