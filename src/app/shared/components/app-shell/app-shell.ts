import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { t } from '../../utils/i18n';

@Component({
  selector: 'app-nav-icon',
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
    <div class="min-h-screen bg-pop-background text-pop-text" [class.dashboard-shell]="dashboard">
      @if (signedIn) {
        <aside class="fixed inset-y-0 left-0 z-20 hidden w-56 overflow-hidden bg-gradient-to-b from-white via-[#faf7ff] to-[#eee8ff] px-4 py-7 lg:flex lg:flex-col" [attr.aria-label]="t('navLabel')">
          <a class="mb-10 flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/dashboard">
            <img src="/illustrations/ourfinance-mark.svg" width="44" height="44" alt="" />
            <span class="text-[22px] font-black tracking-tight text-pop-primary-dark">ourfinance.</span>
          </a>
          <nav class="space-y-2" [attr.aria-label]="t('navLabel')">
            <a class="pop-nav-link" routerLink="/dashboard" routerLinkActive="pop-nav-active"><app-nav-icon name="home" />{{ t('navHome') }}</a>
            <a class="pop-nav-link" routerLink="/groups" routerLinkActive="pop-nav-active"><app-nav-icon name="groups" />{{ t('navGroups') }}</a>
            <a class="pop-nav-link" routerLink="/expenses" routerLinkActive="pop-nav-active"><app-nav-icon name="expenses" />{{ t('navExpenses') }}</a>
            <a class="pop-nav-link" routerLink="/statistics" routerLinkActive="pop-nav-active"><app-nav-icon name="statistics" />{{ t('navStatistics') }}</a>
            <a class="pop-nav-link" routerLink="/account" routerLinkActive="pop-nav-active"><app-nav-icon name="account" />{{ t('navAccount') }}</a>
          </nav>
          <img class="pointer-events-none absolute bottom-0 left-0 w-56" src="/illustrations/sidebar-paris-cafe-v2.png" alt="" aria-hidden="true" />
        </aside>
      }
      <div [class.lg:pl-56]="signedIn">
        @if (signedIn) {
          <header class="relative z-40" [class.dashboard-header]="dashboard" [class.bg-white/90]="!dashboard">
            <div class="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-8" [class.lg:py-6]="dashboard">
              <a class="flex items-center gap-1.5 lg:hidden" routerLink="/dashboard"><img src="/illustrations/ourfinance-mark.svg" width="36" height="36" alt="" /><strong class="text-[22px] font-black tracking-tight text-pop-primary-dark">ourfinance.</strong></a>
              @if (dashboard) {
                <div class="hidden min-w-0 flex-1 lg:block"><h1 class="text-3xl font-black leading-tight text-pop-primary-dark">{{ t('dashboardHello') }}{{ firstName ? ' ' + firstName : '' }} ! 👋</h1><p class="mt-1 text-sm font-semibold text-pop-primary-dark">{{ t('loginHeroLead') }} {{ t('loginHeroHighlight') }}</p></div>
                <form class="hidden w-80 min-h-11 items-center gap-2 rounded-full bg-white px-4 shadow-[0_4px_14px_#5c46ad25] lg:flex" role="search" (submit)="submitSearch($event)">
                  <svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
                  <label class="sr-only" for="dashboard-header-search">{{ t('searchExpenses') }}</label><input id="dashboard-header-search" class="min-w-0 flex-1 bg-transparent py-2 text-sm" type="search" name="search" [value]="searchTerm" (input)="searchTerm = $any($event.target).value" [placeholder]="t('searchExpenses')" />
                  <button class="sr-only focus:not-sr-only" type="submit">{{ t('search') }}</button>
                </form>
              } @else { <span class="hidden font-black text-pop-primary-dark lg:block">{{ pageTitle }}</span> }
              <details #profileMenu class="relative group">
                <summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl px-1 focus-visible:outline-2 focus-visible:outline-pop-primary [&::-webkit-details-marker]:hidden" [attr.aria-label]="t('navAccount')">
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-pop-coral font-black text-white" aria-hidden="true">{{ userInitial }}</span><span class="hidden max-w-40 truncate text-sm font-bold sm:inline">{{ userName }}</span><span class="hidden text-pop-primary-dark sm:inline" aria-hidden="true">⌄</span>
                </summary>
                <div class="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-pop-border bg-white p-2 shadow-xl">
                  <a class="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-pop-lavender focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/account">{{ t('preferences') }}</a>
                  <button class="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-pop-lavender focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="signOut.emit()">{{ t('logout') }}</button>
                </div>
              </details>
            </div>
          </header>
        }
        @if (signedIn) { <img class="pointer-events-none fixed bottom-0 right-0 z-0 hidden w-[min(58vw,700px)] opacity-70 lg:block" src="/illustrations/paris-right-scenery.png" alt="" aria-hidden="true" /> }
        <main class="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8" [class.pb-28]="signedIn" [class.lg:px-8]="signedIn"><ng-content /></main>
      </div>
      @if (signedIn) {
        <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-pop-border bg-white/95 px-2 pt-1.5 pb-[calc(.4rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_#30275212] lg:hidden" [attr.aria-label]="t('navLabel')">
          <div class="mx-auto grid max-w-lg grid-cols-5 gap-1">
            <a class="pop-bottom-link" routerLink="/dashboard" routerLinkActive="pop-bottom-active"><app-nav-icon name="home" />{{ t('navHome') }}</a>
            <a class="pop-bottom-link" routerLink="/groups" routerLinkActive="pop-bottom-active"><app-nav-icon name="groups" />{{ t('navGroups') }}</a>
            <a class="pop-bottom-link" [routerLink]="hasGroups ? '/expenses' : '/groups'" routerLinkActive="pop-bottom-active" [attr.aria-label]="hasGroups ? t('navAdd') : t('createGroup')"><span class="-mt-2 flex size-14 items-center justify-center rounded-full bg-pop-coral text-white shadow-md" aria-hidden="true"><svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><use href="/illustrations/lucide-actions.svg#plus" /></svg></span></a>
            <a class="pop-bottom-link" routerLink="/statistics" routerLinkActive="pop-bottom-active"><app-nav-icon name="statistics" />{{ t('navStatistics') }}</a>
            <a class="pop-bottom-link" routerLink="/account" routerLinkActive="pop-bottom-active"><app-nav-icon name="account" />{{ t('navAccount') }}</a>
          </div>
        </nav>
      }
    </div>
  `,
  styles: [`
    .pop-nav-link { display:flex; align-items:center; gap:.85rem; min-height:3.25rem; border-radius:1rem; padding:0 .85rem; color:var(--color-pop-text); font-weight:800; font-size:1.05rem; }
    .pop-nav-link:hover { background:var(--color-pop-lavender); color:var(--color-pop-primary-dark); }
    .pop-nav-active, .pop-nav-active:hover { background:linear-gradient(110deg, var(--color-pop-primary), var(--color-pop-primary-dark)); color:#fff; box-shadow:0 5px 11px #6455ec2e; }
    .pop-nav-link:focus-visible { outline:2px solid var(--color-pop-primary-dark); outline-offset:2px; }
    .pop-nav-link app-nav-icon { display:flex; width:1.5rem; justify-content:center; }
    .dashboard-header { background:transparent; }
    .dashboard-header::before { content:''; position:absolute; inset:0 0 0 auto; width:60%; pointer-events:none; opacity:.75; background:radial-gradient(circle at 75% 75%, #dac8fa 0 24px, transparent 25px), radial-gradient(circle at 82% 75%, #dac8fa 0 17px, transparent 18px), radial-gradient(circle at 92% 90%, #e1d2fb 0 35px, transparent 36px); }
    .dashboard-header::after { content:''; position:absolute; left:35%; bottom:1.15rem; width:8rem; height:2.2rem; pointer-events:none; opacity:.6; background:radial-gradient(circle at 28% 85%, #d7c5f8 0 1.1rem, transparent 1.15rem), radial-gradient(circle at 52% 55%, #d7c5f8 0 1.45rem, transparent 1.5rem), radial-gradient(circle at 76% 90%, #d7c5f8 0 1rem, transparent 1.05rem); }
    @media (min-width:640px) { .dashboard-shell { background:linear-gradient(180deg,#f4eeff 0px,#ebe1ff 145px,#f6f5ff 360px); } }
    @media (max-width:639px) { .dashboard-shell { background:#fff; } .dashboard-shell main { padding-top:.25rem; } .dashboard-header { background:#fff; } .dashboard-header::before, .dashboard-header::after { display:none; } }
    .pop-bottom-link { display:flex; min-height:3.35rem; flex-direction:column; align-items:center; justify-content:center; gap:.1rem; border-radius:.7rem; color:var(--color-pop-muted); font-size:.62rem; font-weight:750; text-align:center; }
    .pop-bottom-link app-nav-icon { display:flex; }
    .pop-bottom-active { background:var(--color-pop-lavender); color:var(--color-pop-primary-dark); }
    .pop-bottom-link:focus-visible { outline:2px solid var(--color-pop-primary); outline-offset:2px; }
  `],
})
export class AppShell {
  @Input() signedIn = false;
  @Input() hasGroups = false;
  @Input() userInitial = '?';
  @Input() userName = '';
  @Input() pageTitle = '';
  @Input() dashboard = false;
  @Input() firstName = '';
  @Output() signOut = new EventEmitter<void>();
  @Output() searchExpenses = new EventEmitter<string>();
  searchTerm = '';
  @ViewChild('profileMenu') profileMenu?: ElementRef<HTMLDetailsElement>;
  readonly t = t;
  submitSearch(event: Event): void { event.preventDefault(); const term = this.searchTerm.trim(); if (term) this.searchExpenses.emit(term); }
  @HostListener('document:click', ['$event']) closeMenuOutside(event: MouseEvent): void {
    const menu = this.profileMenu?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) menu.open = false;
  }
  @HostListener('document:keydown.escape') closeMenuOnEscape(): void {
    if (this.profileMenu?.nativeElement) this.profileMenu.nativeElement.open = false;
  }
}
