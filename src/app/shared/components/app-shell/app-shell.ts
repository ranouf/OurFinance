import { Component } from '@angular/core';

@Component({
  selector: 'app-shell',
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <span class="text-xl font-bold tracking-tight">OurFinance</span>
          <span class="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">Environnement de test</span>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-5 py-12"><ng-content /></main>
    </div>
  `,
})
export class AppShell {}
