import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { App } from './app';
import { t } from './shared/utils/i18n';
import { GroupOverview } from './features/groups/group-overview';
import { GroupCurrencyPanel } from './features/groups/group-currency-panel';
import { QrInvitationPanel } from './features/groups/qr-invitation-panel';
import { InviteAcceptanceCard } from './features/groups/invite-acceptance-card';
import { CategoryManager } from './features/categories/category-manager';
import { ExpenseForm } from './features/expenses/expense-form';
import { ExpenseHistory } from './features/expenses/expense-history';
import { SettlementForm } from './features/settlements/settlement-form';
import { SettlementHistory } from './features/settlements/settlement-history';
import { BalanceSummary } from './features/balances/balance-summary';
import { StatisticsSummary } from './features/statistics/statistics-summary';
import { ActivityHistory } from './features/activity/activity-history';
import { ExportPanel } from './features/import-export/export-panel';
import { ImportPanel } from './features/import-export/import-panel';
import { RestorePanel } from './features/import-export/restore-panel';
import { ProfilePanel } from './features/profile/profile-panel';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_50px_#30275214] lg:grid lg:min-h-[690px] lg:grid-cols-[1.1fr_1fr]">
      <div class="relative overflow-hidden bg-pop-primary lg:flex lg:flex-col lg:justify-end">
        <div class="flex items-center gap-2 bg-white px-5 py-3 lg:hidden"><img src="/illustrations/ourfinance-mark.svg" width="34" height="34" alt="" /><span class="text-lg font-black text-pop-primary-dark">ourfinance.</span></div>
        <picture><source media="(min-width: 1024px)" srcset="/illustrations/cafe-hero.webp" /><img class="h-56 w-full object-cover object-center sm:h-64 lg:h-full lg:min-h-[690px]" src="/illustrations/cafe-hero-mobile.webp" alt="" /></picture>
        <div class="hidden lg:absolute lg:inset-x-0 lg:top-0 lg:block lg:bg-gradient-to-b lg:from-pop-primary/95 lg:via-pop-primary/75 lg:to-transparent lg:p-8 lg:pb-44 lg:text-white">
          <p class="flex items-center gap-2 text-2xl font-black"><img src="/illustrations/ourfinance-mark.svg" width="42" height="42" alt="" />ourfinance.</p>
          <p class="mt-10 max-w-sm text-4xl font-black leading-tight">{{ t('loginHeroLead') }} <span class="text-pop-sun">{{ t('loginHeroHighlight') }}</span></p>
        </div>
      </div>
      <div class="px-5 py-6 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-12">
        <div class="mb-3 hidden items-center gap-2 lg:flex"><img src="/illustrations/ourfinance-mark.svg" width="37" height="37" alt="" /><span class="text-lg font-black text-pop-primary-dark">ourfinance.</span></div>
        <h1 class="text-2xl font-black leading-tight sm:text-3xl">@if (app.mode() === 'login') { <span class="lg:hidden">{{ t('welcomeMobile') }}</span><span class="hidden lg:inline">{{ app.heading() }}</span> 👋 } @else { {{ app.heading() }} }</h1>
        <p class="mt-1 text-sm text-pop-muted">{{ t('loginIntro') }}</p>
        @if (app.pendingInvite()) {
          <aside class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm" role="status"><strong>{{ app.qrText().received }}</strong> {{ app.qrText().signIn }}
            <button class="ml-2 font-bold text-pop-primary-dark underline" type="button" (click)="app.declineInvite()">{{ app.qrText().decline }}</button>
          </aside>
        }
        @if (app.auth?.user(); as user) {
          <p class="mt-4 break-all text-sm text-pop-muted">{{ t('connectedAs') }} {{ user.email }}.</p>
          @if (!user.emailVerified) {
            <p class="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{{ t('verifyEmail') }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button class="min-h-11 rounded-xl bg-pop-primary px-4 font-bold text-white" type="button" [disabled]="app.busy()" (click)="app.refreshVerification()">{{ app.qrText().refreshVerification }}</button>
              <button class="min-h-11 rounded-xl border border-pop-primary px-4 font-bold text-pop-primary-dark" type="button" [disabled]="app.busy()" (click)="app.resendVerification()">{{ app.qrText().resendVerification }}</button>
            </div>
          }
          <button class="mt-5 min-h-11 font-bold text-pop-primary-dark underline" type="button" (click)="app.logout()">{{ t('logout') }}</button>
        } @else {
          @if (app.mode() !== 'login') {
            <div class="mt-4 flex gap-2 text-sm"><button class="font-bold text-pop-primary-dark underline" type="button" (click)="app.mode.set('login')">{{ t('connection') }}</button></div>
          }
          <form class="mt-5 space-y-4" (ngSubmit)="app.submit()">
            <label class="block text-sm font-bold">{{ t('email') }}<span class="relative mt-1 block"><svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pop-primary-dark" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></svg><input class="min-h-11 w-full rounded-xl border border-pop-border bg-pop-background py-2 pl-10 pr-3 focus-visible:outline-2 focus-visible:outline-pop-primary" type="email" name="email" autocomplete="email" [(ngModel)]="app.email" required /></span></label>
            @if (app.mode() !== 'reset') {
              <label class="block text-sm font-bold">{{ t('password') }}
                <span class="mt-1 flex rounded-xl border border-pop-border bg-pop-background focus-within:outline-2 focus-within:outline-pop-primary">
                  <svg class="ml-3 shrink-0 self-center text-pop-primary-dark" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  <input class="min-h-11 min-w-0 flex-1 bg-transparent px-2 outline-none" [type]="app.showPassword() ? 'text' : 'password'" name="password" [autocomplete]="app.mode() === 'register' ? 'new-password' : 'current-password'" [(ngModel)]="app.password" required />
                  <button class="flex min-h-11 min-w-11 items-center justify-center px-3 text-pop-primary-dark" type="button" (click)="app.showPassword.update(value => !value)" [attr.aria-label]="app.showPassword() ? t('hidePassword') : t('showPassword')"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button>
                </span>
              </label>
            }
            @if (app.mode() === 'login') { <button class="block min-h-9 w-full text-right text-xs font-bold text-pop-primary-dark" type="button" (click)="app.mode.set('reset')">{{ t('forgotten') }}</button> }
            <button class="min-h-12 w-full rounded-xl bg-pop-coral px-4 font-extrabold text-pop-text hover:brightness-95 disabled:opacity-50" [disabled]="app.busy() || !app.online()" type="submit">{{ app.mode() === 'register' ? t('register') : app.mode() === 'reset' ? t('resetSend') : t('login') }}</button>
          </form>
          @if (app.mode() === 'login') {
            <div class="my-3 flex items-center gap-3 text-xs text-pop-muted"><span class="h-px flex-1 bg-pop-border"></span>{{ t('or') }}<span class="h-px flex-1 bg-pop-border"></span></div>
            <button class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-pop-border px-4 font-bold disabled:opacity-50" type="button" [disabled]="app.busy() || !app.online()" (click)="app.google()"><span class="bg-gradient-to-br from-blue-600 via-red-500 to-green-600 bg-clip-text text-xl font-black text-transparent" aria-hidden="true">G</span>{{ t('google') }}</button>
            <p class="mt-4 text-center text-sm text-pop-muted">{{ t('newHere') }} <button class="font-bold text-pop-primary-dark underline" type="button" (click)="app.mode.set('register')">{{ t('signup') }}</button></p>
          }
        }
        @if (app.message()) { <p class="mt-4 text-sm" role="status">{{ app.message() }}</p> }
      </div>
    </div>
  `,
})
export class LoginPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [RouterLink, GroupOverview],
  template: `
    <div class="mx-auto max-w-5xl">
      @if (app.selectedGroup()) { <div class="hidden items-start justify-between gap-3 sm:flex">
        <div><p class="text-xs font-bold text-pop-muted">{{ t('todayLabel') }}</p><h1 class="mt-1 text-2xl font-black sm:text-3xl">{{ t('dashboardGreeting') }} 👋</h1><p class="mt-1 text-sm text-pop-muted">{{ t('dashboardIntro') }}</p></div>
        @if (app.selectedGroup()) { <a class="hidden min-h-11 items-center rounded-xl bg-pop-coral px-4 text-sm font-extrabold text-pop-text sm:inline-flex" routerLink="/expenses">+ {{ t('navAdd') }}</a> }
      </div> }
      @if (app.groupsBusy()) {
        <p class="mt-6 rounded-2xl border border-pop-border bg-white p-6" role="status">{{ t('loadingGroupList') }}</p>
      } @else if (app.groupsError()) {
        <p class="mt-6 rounded-2xl border border-pop-border bg-white p-6" role="alert">{{ t('groupsUnavailable') }}</p>
      } @else if (app.selectedGroup(); as group) {
        <section class="relative mt-2 min-h-44 overflow-hidden rounded-[1.5rem] bg-pop-primary p-5 text-white shadow-[0_12px_30px_#6455ec30] sm:mt-5 sm:min-h-48 sm:p-8" [attr.aria-label]="t('myBalance')">
          <img class="pointer-events-none absolute bottom-0 right-0 w-48 opacity-95 sm:bottom-[-70px] sm:w-[370px]" src="/illustrations/couple-cafe.webp" alt="" />
          <div class="relative max-w-[65%]"><p class="text-xl font-black sm:hidden">{{ t('dashboardHello') }}{{ app.firstName() ? ' ' + app.firstName() : '' }} ! 👋</p><p class="mt-2 text-sm font-bold sm:mt-0">{{ group.name }} · {{ group.currency }}</p><p class="mt-4 text-sm">{{ app.balanceLabel() }}</p>
            @if (app.balanceBusy()) { <p role="status">{{ t('loadingBalances') }}</p> }
            @else if (app.balanceError()) { <p role="status">{{ t('balancesUnavailable') }}</p> }
            @else { <p class="text-3xl font-black sm:text-5xl">{{ app.selectedBalance() }}</p> }
            <a class="mt-4 inline-block text-sm font-bold underline" routerLink="/groups">{{ t('viewGroup') }} →</a>
          </div>
        </section>
        <div class="mt-4 hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
          <a class="flex min-w-0 items-center gap-2 rounded-2xl bg-pop-lavender p-4" routerLink="/statistics"><span class="text-2xl" aria-hidden="true">⚖️</span><span class="min-w-0"><span class="block text-xs font-bold text-pop-muted">{{ t('myBalance') }}</span><strong class="block break-words text-sm">{{ app.balanceBusy() ? t('loadingBalances') : app.balanceError() ? t('balancesUnavailable') : app.selectedBalance() }}</strong></span></a>
          <a class="flex min-w-0 items-center gap-2 rounded-2xl bg-pop-peach p-4" routerLink="/statistics"><span class="text-2xl" aria-hidden="true">🧾</span><span class="min-w-0"><span class="block text-xs font-bold text-pop-muted">{{ t('groupTotal') }}</span><strong class="block break-words text-sm">{{ app.balanceBusy() ? t('loadingBalances') : app.balanceError() ? t('balancesUnavailable') : app.groupSpent() }}</strong></span></a>
          <a class="flex min-w-0 items-center gap-2 rounded-2xl bg-pop-mint-soft p-4" routerLink="/statistics"><svg class="shrink-0 text-emerald-700" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 18 18 5M9 5h9v9" /></svg><span class="min-w-0"><span class="block text-xs font-bold text-pop-muted">{{ t('receivable') }}</span><strong class="block break-words text-sm">{{ app.balanceBusy() ? t('loadingBalances') : app.balanceError() ? t('balancesUnavailable') : app.receivableAmount() }}</strong></span></a>
          <a class="flex min-w-0 items-center gap-2 rounded-2xl bg-amber-50 p-4" routerLink="/statistics"><svg class="shrink-0 text-pop-coral" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 5 13 13m0-9v9H9" /></svg><span class="min-w-0"><span class="block text-xs font-bold text-pop-muted">{{ t('toRepay') }}</span><strong class="block break-words text-sm">{{ app.balanceBusy() ? t('loadingBalances') : app.balanceError() ? t('balancesUnavailable') : app.payableAmount() }}</strong></span></a>
        </div>
        <div class="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section [attr.aria-label]="t('myGroups')">
        <div class="flex items-center justify-between"><h2 class="text-xl font-black">{{ t('myGroups') }}</h2><a class="text-sm font-bold text-pop-primary-dark" routerLink="/groups">{{ t('viewAll') }} →</a></div>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          @for (item of app.groups(); track item.id) {
            <button [class]="($index > 1 ? 'hidden sm:flex' : 'flex') + ' min-h-16 items-center gap-3 rounded-2xl border border-pop-border bg-white p-3 text-left sm:min-h-20 sm:p-4'" type="button" [attr.aria-pressed]="app.selectedGroupId() === item.id" (click)="app.selectedGroupId.set(item.id)">
              <img class="h-11 w-11" [src]="$index % 2 ? '/illustrations/category-travel.svg' : '/illustrations/category-home.svg'" alt="" /><span class="min-w-0 flex-1"><strong class="block break-words">{{ item.name }}</strong><small class="text-pop-muted">{{ item.memberCount ?? 1 }} {{ t('membersCount') }}</small></span><span class="flex shrink-0 flex-col items-end gap-1"><span class="rounded-full bg-pop-lavender px-2 py-1 text-xs font-bold">{{ item.currency }}</span>@if (item.id === app.selectedGroupId() && !app.balanceBusy() && !app.balanceError()) { <strong class="text-xs" [class.text-emerald-700]="app.selectedBalanceMinor() > 0" [class.text-pop-coral]="app.selectedBalanceMinor() < 0">{{ app.selectedBalance() }}</strong> }</span>
            </button>
          }
        </div>
        <a class="mt-3 flex min-h-11 items-center justify-center rounded-2xl bg-pop-lavender text-sm font-extrabold text-pop-primary-dark sm:hidden" routerLink="/groups">+ {{ t('createGroup') }}</a>
        </section>
        <section [attr.aria-label]="t('recentExpenses')">
          <div class="flex items-center justify-between"><h2 class="text-xl font-black">{{ t('recentExpenses') }}</h2><a class="text-sm font-bold text-pop-primary-dark" routerLink="/expenses">{{ t('viewAll') }} →</a></div>
          <div class="mt-3 divide-y divide-pop-border overflow-hidden rounded-2xl border border-pop-border bg-white">
            @if (app.recentExpensesBusy()) { <p class="p-4 text-sm text-pop-muted" role="status">{{ t('loadingExpenseHistory') }}</p> }
            @else if (app.recentExpensesError()) { <p class="p-4 text-sm text-pop-muted" role="status">{{ t('historyUnavailable') }}</p> }
            @else if (!app.recentExpenses().length) { <p class="p-4 text-sm text-pop-muted">{{ t('noRecentExpenses') }}</p> }
            @else { @for (entry of app.recentExpenses(); track entry.id) {
              <div class="flex items-center gap-3 p-3"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pop-lavender text-xl" aria-hidden="true">{{ entry.categoryIcon }}</span><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ entry.description }}</strong><small class="text-pop-muted">{{ entry.date }} · {{ group.name }}</small></span><strong class="shrink-0 text-sm">{{ app.formatRecentExpense(entry) }}</strong></div>
            } }
          </div>
        </section>
        </div>
        <div class="mt-5 grid grid-cols-3 gap-2 sm:hidden">
          <a class="rounded-2xl bg-pop-peach p-3 text-center text-xs font-extrabold" routerLink="/expenses"><span class="mb-2 block text-2xl" aria-hidden="true">▤</span>{{ t('navAdd') }}</a>
          <a class="rounded-2xl bg-pop-lavender p-3 text-center text-xs font-extrabold" routerLink="/groups"><span class="mb-2 block text-2xl" aria-hidden="true">♧</span>{{ t('navGroups') }}</a>
          <a class="rounded-2xl bg-amber-50 p-3 text-center text-xs font-extrabold" routerLink="/statistics"><span class="mb-2 block text-2xl" aria-hidden="true">▥</span>{{ t('navStatistics') }}</a>
        </div>
        @if (app.firebaseApp && app.auth?.user(); as user) { <app-group-overview [group]="group" [firebaseApp]="app.firebaseApp" [user]="user" [revision]="app.expenseRevision() + app.settlementRevision() + app.categoryRevision() + app.commentRevision()" /> }
      } @else {
        <section class="relative mt-6 overflow-hidden rounded-[1.8rem] bg-pop-primary px-6 pt-8 text-white shadow-[0_15px_35px_#6455ec33] sm:px-10 sm:pt-12 lg:min-h-[330px]">
          <div class="relative z-10 max-w-md pb-2 sm:max-w-[48%] sm:pb-12 lg:max-w-md">
            <h2 class="text-3xl font-black leading-tight lg:text-5xl">{{ t('emptyDashboardTitle') }} 👋</h2>
            <p class="mt-4 max-w-sm text-base font-semibold text-white/90 sm:text-xl">{{ t('emptyDashboardText') }}</p>
            <a class="mt-6 inline-flex min-h-12 items-center rounded-xl bg-pop-coral px-5 font-extrabold text-pop-text shadow-sm" routerLink="/groups">+ {{ t('createFirstGroup') }}</a>
          </div>
          <img class="pointer-events-none relative z-0 mx-auto -mb-3 h-48 w-full max-w-sm object-contain sm:absolute sm:-right-4 sm:bottom-0 sm:mb-0 sm:h-[280px] sm:w-[55%] sm:max-w-none lg:h-[330px]" src="/illustrations/friends-celebrating.webp" alt="" />
        </section>
        <section class="mt-6 rounded-[1.8rem] border border-pop-border bg-white p-5 shadow-sm sm:p-8" [attr.aria-label]="t('gettingStarted')">
          <h2 class="text-2xl font-black">{{ t('gettingStarted') }} ✨</h2>
          <p class="mt-1 text-sm text-pop-muted">{{ t('gettingStartedIntro') }}</p>
          <ol class="mt-5 grid gap-3 sm:grid-cols-3">
            <li class="rounded-2xl bg-pop-peach p-5"><img class="h-12 w-12" src="/illustrations/category-home.svg" alt="" /><strong class="mt-3 block text-lg">1. {{ t('stepGroup') }}</strong><p class="mt-1 text-sm text-pop-muted">{{ t('stepGroupText') }}</p></li>
            <li class="rounded-2xl bg-pop-lavender p-5"><span class="text-4xl text-pop-primary" aria-hidden="true">▤</span><strong class="mt-3 block text-lg">2. {{ t('stepExpense') }}</strong><p class="mt-1 text-sm text-pop-muted">{{ t('stepExpenseText') }}</p></li>
            <li class="rounded-2xl bg-amber-50 p-5"><span class="text-4xl text-pop-primary" aria-hidden="true">▥</span><strong class="mt-3 block text-lg">3. {{ t('stepBalance') }}</strong><p class="mt-1 text-sm text-pop-muted">{{ t('stepBalanceText') }}</p></li>
          </ol>
        </section>
      }
    </div>
  `,
})
export class DashboardPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [FormsModule, GroupCurrencyPanel, QrInvitationPanel, CategoryManager],
  template: `
    <div class="mx-auto max-w-5xl space-y-6">
      <header><p class="text-sm font-bold text-pop-muted">{{ t('myGroups') }}</p><h1 class="text-3xl font-black">{{ t('navGroups') }}</h1></header>
      @if (app.groups().length) {
        <div class="grid gap-3 sm:grid-cols-2">
          @for (group of app.groups(); track group.id) {
            <button class="flex min-h-20 items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm" [class.border-pop-primary]="app.selectedGroupId() === group.id" [class.border-pop-border]="app.selectedGroupId() !== group.id" type="button" (click)="app.selectedGroupId.set(group.id)">
              <img class="h-12 w-12" src="/illustrations/category-home.svg" alt="" /><span class="min-w-0 flex-1"><strong class="block break-words">{{ group.name }}</strong><small class="text-pop-muted">{{ group.memberCount ?? 1 }} {{ t('membersCount') }}</small></span><span class="rounded-full bg-pop-lavender px-2 py-1 text-xs font-bold">{{ group.currency }}</span>
            </button>
          }
        </div>
      } @else { <div class="flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-pop-border bg-white p-5 sm:flex-row sm:justify-between"><p class="text-pop-muted">{{ t('noGroups') }}</p><img class="h-32 w-full max-w-56 object-contain sm:w-56" src="/illustrations/friends-planning-trip.webp" alt="" /></div> }
      @if (app.groupServiceReady() && app.auth?.user()?.emailVerified) {
        <form class="max-w-xl space-y-4 rounded-2xl border border-pop-border bg-white p-5" (ngSubmit)="app.createGroup()">
          <h2 class="text-xl font-black">{{ t('createGroup') }}</h2>
          <label class="block text-sm font-bold">{{ t('groupName') }}<input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border px-3" name="groupName" [(ngModel)]="app.groupName" maxlength="80" required /></label>
          <label class="block text-sm font-bold">{{ t('groupCurrency') }}<select class="mt-1 min-h-11 w-full rounded-xl border border-pop-border px-3" name="groupCurrency" [(ngModel)]="app.groupCurrency">@for (currency of app.currencies(); track currency.code) { <option [value]="currency.code">{{ currency.code }} · {{ currency.name }}</option> }</select></label>
          <button class="min-h-11 rounded-xl bg-pop-primary px-5 font-bold text-white disabled:opacity-50" type="submit" [disabled]="app.busy() || !app.online()">{{ t('createGroup') }}</button>
        </form>
      } @else { <p class="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">{{ t('groupServiceMissing') }}</p> }
      @if (app.workerUrl && app.auth?.user(); as user) {
        @if (app.firebaseApp && app.groups().length) { <app-group-currency-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onInvitationJoined()" /> }
        <app-qr-invitation-panel [groups]="app.groups()" [user]="user" [workerUrl]="app.workerUrl" />
        @if (app.firebaseApp && app.groups().length) { <app-category-manager [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onCategoryChanged()" /> }
      }
      @if (app.message()) { <p role="status">{{ app.message() }}</p> }
    </div>
  `,
})
export class GroupsPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [ExpenseForm, ExpenseHistory],
  template: `
    <div class="mx-auto max-w-5xl">
      <header class="mb-5"><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navExpenses') }}</h1></header>
      @if (app.workerUrl && app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          <div class="grid gap-5 xl:grid-cols-[1fr_18rem]">
            <app-expense-history class="min-w-0" [groups]="app.groups()" [firebaseApp]="app.firebaseApp" [user]="user" [workerUrl]="app.workerUrl" [revision]="app.expenseRevision()" [categoryRevision]="app.categoryRevision()" (commented)="app.onCommentAdded()" (editRequested)="app.onExpenseEdit($event)" (deleted)="app.onExpenseSaved()" />
            <app-expense-form id="expense-editor" [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [categoryRevision]="app.categoryRevision()" [editing]="app.editingExpense()" (saved)="app.onExpenseSaved()" (editCancelled)="app.editingExpense.set(undefined)" />
          </div>
        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class ExpensesPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [StatisticsSummary, BalanceSummary, SettlementForm, SettlementHistory],
  template: `
    <div class="mx-auto max-w-5xl"><header class="mb-5"><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navStatistics') }}</h1></header>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          <app-statistics-summary [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" />
          <app-balance-summary [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" />
          @if (app.workerUrl) { <app-settlement-form [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (saved)="app.onSettlementSaved()" />
            <app-settlement-history [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [revision]="app.settlementRevision()" /> }
        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class StatisticsPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [ProfilePanel, ActivityHistory, ExportPanel, ImportPanel, RestorePanel],
  template: `
    <div class="mx-auto max-w-5xl space-y-5"><h1 class="text-3xl font-black">{{ t('navAccount') }}</h1>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        <app-profile-panel [user]="user" [firebaseApp]="app.firebaseApp" />
        @if (app.groups().length) {
          <div id="activity"><app-activity-history [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision() + app.categoryRevision() + app.commentRevision()" /></div>
          <app-export-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
          @if (app.workerUrl) { <app-import-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
            <app-restore-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" /> }
        }
      }
      <button class="min-h-11 rounded-xl border border-pop-border bg-white px-4 font-bold" type="button" (click)="app.logout()">{{ t('logout') }}</button>
    </div>
  `,
})
export class AccountPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [InviteAcceptanceCard, LoginPage],
  template: `
    @if (app.auth?.user(); as user) {
      @if (user.emailVerified && app.pendingInvite() && app.workerUrl) {
        <app-invite-acceptance-card [user]="user" [workerUrl]="app.workerUrl" [token]="app.pendingInvite()!" (joined)="app.onQrJoined($event)" (declined)="app.declineInvite()" (changeAccount)="app.logout()" (invalidated)="app.clearStoredInvite()" />
      } @else { <app-login-page /> }
    } @else { <app-login-page /> }
  `,
})
export class JoinPage { readonly app = inject(App); }
