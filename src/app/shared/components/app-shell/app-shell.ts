import { Component } from '@angular/core';

@Component({
  selector: 'app-shell',
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <a class="text-xl font-bold tracking-tight" href="/">OurFinance</a>
          <span class="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">Fondation en cours</span>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-5 py-16">
        <div class="max-w-xl">
          <p class="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">Vos dépenses, à votre façon</p>
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Des comptes clairs pour chaque groupe.</h1>
          <p class="mt-6 text-lg leading-relaxed text-slate-600">
            Suivez vos dépenses personnelles ou partagées, avec des groupes indépendants et des répartitions que vous choisissez.
          </p>
          <p class="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            L’application est en construction. La création de compte et l’enregistrement des dépenses ne sont pas encore disponibles.
          </p>
        </div>
      </main>
    </div>
  `,
})
export class AppShell {}
