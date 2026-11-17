import { Component, Input } from '@angular/core';
import { t } from '../../utils/i18n';

@Component({
  selector: 'app-shell',
  template: `
    <div class="min-h-screen bg-pop-background text-pop-text">
      @if (signedIn) {
        <aside class="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-pop-border bg-white px-5 py-7 lg:flex lg:flex-col" [attr.aria-label]="t('navLabel')">
          <a class="mb-12 flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-pop-primary" href="#groups">
            <img src="/illustrations/ourfinance-mark.svg" width="42" height="42" alt="" />
            <span class="text-xl font-extrabold tracking-tight">OurFinance</span>
          </a>
          <nav class="space-y-2" [attr.aria-label]="t('navLabel')">
            <a class="pop-nav-link" href="#groups"><span aria-hidden="true">⌂</span>{{ t('navGroups') }}</a>
            <a class="pop-nav-link" href="#new-expense"><span aria-hidden="true">＋</span>{{ t('navAdd') }}</a>
            <a class="pop-nav-link" href="#history"><span aria-hidden="true">☷</span>{{ t('navHistory') }}</a>
            <a class="pop-nav-link" href="#balances"><span aria-hidden="true">↗</span>{{ t('navBalances') }}</a>
            <a class="pop-nav-link" href="#account"><span aria-hidden="true">○</span>{{ t('navAccount') }}</a>
          </nav>
          <span class="mt-auto rounded-full bg-pop-lavender px-3 py-2 text-center text-xs font-bold text-pop-primary-dark">{{ t('testEnvironment') }}</span>
        </aside>
      }
      <div [class.lg:pl-60]="signedIn">
        <header class="border-b border-pop-border bg-white/90">
          <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
            <a class="flex min-w-0 items-center gap-2 lg:hidden" href="#groups">
              <img src="/illustrations/ourfinance-mark.svg" width="38" height="38" alt="" />
              <span class="truncate text-lg font-extrabold tracking-tight">OurFinance</span>
            </a>
            <span class="hidden text-sm font-semibold text-pop-muted lg:block">OurFinance</span>
            <span class="shrink-0 rounded-full bg-pop-lavender px-3 py-1.5 text-xs font-bold text-pop-primary-dark max-[359px]:hidden">{{ t('testEnvironment') }}</span>
          </div>
        </header>
        <main class="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9" [class.pb-28]="signedIn"><ng-content /></main>
      </div>
      @if (signedIn) {
        <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-pop-border bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_#30275212] lg:hidden" [attr.aria-label]="t('navLabel')">
          <div class="mx-auto grid max-w-lg grid-cols-5 gap-1">
            <a class="pop-bottom-link" href="#groups"><span aria-hidden="true">⌂</span>{{ t('navGroups') }}</a>
            <a class="pop-bottom-link" href="#new-expense"><span class="flex h-11 w-11 items-center justify-center rounded-full bg-pop-primary text-2xl text-white shadow-md" aria-hidden="true">＋</span>{{ t('navAdd') }}</a>
            <a class="pop-bottom-link" href="#history"><span aria-hidden="true">☷</span>{{ t('navHistory') }}</a>
            <a class="pop-bottom-link" href="#balances"><span aria-hidden="true">↗</span>{{ t('navBalances') }}</a>
            <a class="pop-bottom-link" href="#account"><span aria-hidden="true">○</span>{{ t('navAccount') }}</a>
          </div>
        </nav>
      }
    </div>
  `,
  styles: [`
    .pop-nav-link { display:flex; align-items:center; gap:.875rem; min-height:3rem; border-radius:.875rem; padding:0 .875rem; color:var(--color-pop-text); font-weight:700; }
    .pop-nav-link:hover, .pop-nav-link:focus-visible { background:var(--color-pop-lavender); color:var(--color-pop-primary-dark); }
    .pop-nav-link span { width:1.5rem; text-align:center; font-size:1.4rem; }
    .pop-bottom-link { display:flex; min-height:3.5rem; flex-direction:column; align-items:center; justify-content:center; gap:.15rem; border-radius:.75rem; color:var(--color-pop-text); font-size:.65rem; font-weight:700; text-align:center; }
    .pop-bottom-link > span:not(.rounded-full) { font-size:1.4rem; line-height:1.35rem; color:var(--color-pop-primary); }
    .pop-bottom-link:focus-visible { outline:2px solid var(--color-pop-primary); outline-offset:2px; }
  `],
})
export class AppShell { @Input() signedIn = false; readonly t = t; }
