import { Component } from '@angular/core';
import { t } from '../../utils/i18n';

@Component({
  selector: 'app-shell',
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white" aria-hidden="true">O</span>
            <span class="truncate text-lg font-bold tracking-tight sm:text-xl">OurFinance</span>
          </div>
          <span class="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 sm:px-3 sm:text-sm">{{ t('testEnvironment') }}</span>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10"><ng-content /></main>
    </div>
  `,
})
export class AppShell { readonly t = t; }
