import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { App } from './app';
import { LoginPage } from './login-page';
import { language, t } from './shared/utils/i18n';
import { categoryById, categoryColorClass, categoryColors, categoryIcons } from './shared/utils/categories';
import { GroupOverview } from './features/groups/group-overview';
import { GroupCurrencyPanel } from './features/groups/group-currency-panel';
import { GroupLifecyclePanel } from './features/groups/group-lifecycle-panel';
import { GroupMetadataPanel } from './features/groups/group-metadata-panel';
import { groupMetadataText } from './features/groups/group-metadata-text';
import { QrInvitationPanel } from './features/groups/qr-invitation-panel';
import { InviteAcceptanceCard } from './features/groups/invite-acceptance-card';
import { CategoryManager } from './features/categories/category-manager';
import { ExpenseForm } from './features/expenses/expense-form';
import { ExpenseHistory } from './features/expenses/expense-history';
import { ReceiptCleanupPanel } from './features/expenses/receipt-cleanup-panel';
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
  imports: [FormsModule, RouterLink, GroupOverview],
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
        <form class="mt-3 flex min-h-11 items-center gap-2 rounded-2xl border border-pop-border bg-white px-3 shadow-sm focus-within:outline-2 focus-within:outline-pop-primary sm:mt-5" (ngSubmit)="searchExpenses()" role="search">
          <svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
          <label class="sr-only" for="dashboard-expense-search">{{ t('searchExpenses') }}</label>
          <input id="dashboard-expense-search" class="min-w-0 flex-1 py-2 text-sm outline-none" type="search" name="dashboardExpenseSearch" [(ngModel)]="search" [placeholder]="t('searchExpenses')" />
          <button class="rounded-xl bg-pop-lavender px-3 py-1.5 text-sm font-bold text-pop-primary-dark hover:bg-pop-primary hover:text-white focus-visible:outline-2 focus-visible:outline-pop-primary" type="submit">{{ t('search') }}</button>
        </form>
        <section class="dashboard-cloud relative mt-3 overflow-hidden rounded-[1.8rem] bg-pop-primary text-white shadow-[0_12px_30px_#6455ec30] sm:mt-5" [attr.aria-label]="t('myBalance')">
          <div class="relative min-h-44 px-5 pb-20 pt-5 sm:hidden">
            <div class="relative z-10 max-w-[54%]"><p class="text-xl font-black leading-tight">{{ t('dashboardHello') }}{{ app.firstName() ? ' ' + app.firstName() : '' }} ! 👋</p><p class="mt-2 text-xs text-white/90">{{ t('dashboardIntro') }}</p><p class="mt-3 text-xs font-bold">{{ group.name }} · {{ group.currency }}</p></div>
            <img class="pointer-events-none absolute inset-0 h-full w-full origin-left scale-[1.38] object-cover object-left opacity-90" src="/illustrations/cafe-hero-mobile.webp" alt="" />
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-pop-primary via-pop-primary/85 to-transparent"></div>
          </div>
          <div class="hidden min-h-64 grid-cols-[52%_48%] sm:grid">
            <div class="relative overflow-hidden"><img class="absolute inset-0 h-full w-full object-cover object-[16%_45%]" src="/illustrations/cafe-hero-mobile.webp" alt="" /><div class="absolute inset-y-0 right-0 w-20 bg-gradient-to-r from-transparent to-pop-primary"></div></div>
            <div class="flex min-w-0 flex-col justify-center px-5 py-6 lg:px-8"><p class="text-xs font-bold uppercase tracking-wider text-white">{{ t('myGroups') }} · {{ group.currency }}</p><h1 class="mt-1 break-words text-2xl font-black lg:text-4xl">{{ group.name }}</h1><p class="mt-2 text-sm text-white/80">{{ group.memberCount ?? 1 }} {{ t('membersCount') }}</p>
              @if (app.balanceBusy()) { <p class="mt-5" role="status">{{ t('loadingBalances') }}</p> } @else if (app.balanceError()) { <p class="mt-5" role="status">{{ t('balancesUnavailable') }}</p> } @else { <div class="mt-5 grid grid-cols-2 gap-3"><div><span class="block text-xs text-white/80">{{ t('myBalance') }}</span><strong class="text-xl lg:text-2xl">{{ app.selectedBalance() }}</strong></div><div><span class="block text-xs text-white/80">{{ t('groupTotal') }}</span><strong class="text-xl lg:text-2xl">{{ app.groupSpent() }}</strong></div><div><span class="block text-xs text-white/80">{{ t('totalRepayments') }}</span><strong class="text-xl lg:text-2xl">{{ app.settlementTotal() }}</strong></div></div> }
            </div>
          </div>
          <div class="absolute bottom-3 right-3 z-10 flex -space-x-2 sm:bottom-4 sm:right-4" role="group" [attr.aria-label]="t('whoOwes')">
            @for (item of app.dashboardMemberBalances(); track item.userId) {
              @if (app.dashboardMemberName(item.userId); as name) {
                <span class="group relative flex size-9 items-center justify-center rounded-full border-2 border-white bg-pop-peach text-sm font-black text-pop-primary-dark shadow-md outline-none focus-visible:ring-2 focus-visible:ring-pop-sun" tabindex="0" [attr.aria-label]="name + ' · ' + memberBalanceLabel(item.balanceMinor) + ' ' + app.formatDashboardMinor(item.balanceMinor)">
                  {{ name.slice(0, 1).toLocaleUpperCase() }}
                  <span class="pointer-events-none absolute bottom-full right-0 mb-2 hidden min-w-max rounded-xl bg-pop-text px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block group-focus:block">{{ name }} · {{ memberBalanceLabel(item.balanceMinor) }} {{ app.formatDashboardMinor(item.balanceMinor) }}</span>
                </span>
              }
            }
          </div>
        </section>
        <div class="mt-4 flex max-w-full min-w-0 snap-x gap-3 overflow-x-auto pb-1 sm:hidden" [attr.aria-label]="t('myGroups')">
          @for (item of app.groups(); track item.id) { <button class="flex min-h-16 shrink-0 snap-start items-center gap-3 rounded-2xl border border-pop-border bg-white p-3 text-left" [class.w-full]="app.groups().length === 1" [class.w-[80%]]="app.groups().length > 1" type="button" [attr.aria-pressed]="app.selectedGroupId() === item.id" (click)="app.selectedGroupId.set(item.id)"><img class="h-10 w-10" [src]="$index % 2 ? '/illustrations/category-travel.svg' : '/illustrations/category-home.svg'" alt="" /><span class="min-w-0 flex-1"><strong class="block truncate">{{ item.name }}</strong><small>{{ item.memberCount ?? 1 }} {{ t('membersCount') }}</small></span><span class="rounded-full bg-pop-lavender px-2 py-1 text-xs font-bold">{{ item.currency }}</span></button> }
        </div>
        <a class="mt-2 flex min-h-11 items-center justify-center rounded-2xl bg-pop-lavender text-sm font-extrabold text-pop-primary-dark sm:hidden" routerLink="/groups">+ {{ t('createGroup') }}</a>
        <div class="flex flex-col">
        <nav class="mt-5 grid gap-3 sm:grid-cols-3" [attr.aria-label]="t('quickActions')">
          <a class="dashboard-action dashboard-action-coral" routerLink="/expenses"><span class="dashboard-action-icon dashboard-action-icon-coral" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="5" stroke-linecap="round" /></svg></span><strong>{{ t('addExpenseAction') }}</strong></a>
          <a class="dashboard-action dashboard-action-lavender" routerLink="/groups"><span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/></svg></span><strong>{{ t('inviteQrAction') }}</strong><svg class="dashboard-action-qr" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M2 2h12v12H2zM22 2h12v12H22zM2 22h12v12H2z" stroke="currentColor" stroke-width="3"/><path d="M22 22h4v4h-4zM30 22h4v4h-4zM22 30h4v4h-4zM30 30h4v4h-4z" fill="currentColor"/></svg></a>
          <a class="dashboard-action dashboard-action-lavender" routerLink="/statistics"><span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M11 16h25l-6-6m6 6-6 6M37 32H12l6-6m-6 6 6 6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>{{ t('settleAction') }}</strong></a>
        </nav>
        <div class="order-1 mt-5 grid gap-4 sm:order-2 lg:grid-cols-3">
          <section class="order-2 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12] lg:order-1" [attr.aria-label]="t('whoOwes')">
            <h2 class="flex items-center gap-2 text-lg font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v17M5 7h14M4 7l-3 7h6L4 7Zm16 0-3 7h6l-3-7ZM7 20h10" /></svg>{{ t('whoOwes') }}</h2>
            @if (app.balanceBusy()) { <p class="mt-4 text-sm" role="status">{{ t('loadingBalances') }}</p> }
            @else if (app.balanceError()) { <p class="mt-4 text-sm" role="status">{{ t('balancesUnavailable') }}</p> }
            @else if (!app.dashboardMemberBalances().length) { <p class="mt-4 text-sm text-pop-muted">{{ t('noBalance') }}</p> }
            @else { <ul class="mt-3 divide-y divide-pop-border">
              @for (item of app.dashboardMemberBalances(); track item.userId) {
                <li class="flex min-h-12 items-center gap-2 py-1.5 text-sm"><span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pop-peach to-pop-lavender font-black text-pop-primary-dark" aria-hidden="true">{{ app.dashboardMemberName(item.userId).slice(0, 1).toLocaleUpperCase() }}</span><span class="min-w-0 flex-1 truncate font-bold">{{ app.dashboardMemberName(item.userId) }}</span><strong class="shrink-0 rounded-full px-2.5 py-1 text-xs" [class.bg-emerald-50]="item.balanceMinor > 0" [class.text-emerald-700]="item.balanceMinor > 0" [class.bg-rose-50]="item.balanceMinor < 0" [class.text-rose-700]="item.balanceMinor < 0" [class.bg-pop-background]="!item.balanceMinor">{{ app.formatDashboardMinor(item.balanceMinor) }}</strong></li>
              }
            </ul> }
          </section>
          <section class="order-1 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12] lg:order-2" [attr.aria-label]="t('recentExpenses')">
            <div class="flex items-center justify-between gap-2"><h2 class="flex min-w-0 items-center gap-2 text-lg font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>{{ t('recentExpenses') }}</h2><a class="shrink-0 text-xs font-bold text-pop-primary-dark" routerLink="/expenses">{{ t('viewAll') }} →</a></div>
            <div class="mt-3 divide-y divide-pop-border">
              @if (app.recentExpensesBusy()) { <p class="py-3 text-sm" role="status">{{ t('loadingExpenseHistory') }}</p> }
              @else if (app.recentExpensesError()) { <p class="py-3 text-sm" role="status">{{ t('historyUnavailable') }}</p> }
              @else if (!app.recentExpenses().length) { <p class="py-3 text-sm text-pop-muted">{{ t('noRecentExpenses') }}</p> }
              @else { @for (entry of app.recentExpenses(); track entry.id) { <div class="flex min-h-12 items-center gap-2 py-1.5"><span class="flex size-9 shrink-0 items-center justify-center rounded-full text-lg" [class]="categoryColorClass(entry.categoryColor)" aria-hidden="true">{{ entry.categoryIcon }}</span><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ entry.description }}</strong><small class="text-pop-muted">{{ entry.date }}</small></span><strong class="shrink-0 text-xs text-pop-primary-dark">{{ app.formatRecentExpense(entry) }}</strong></div> } }
            </div>
          </section>
          <section class="order-3 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12]" [attr.aria-label]="t('byCategory')">
            <div class="flex items-center justify-between gap-2"><h2 class="flex min-w-0 items-center gap-2 text-base font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="3"/><rect x="9" y="9" width="12" height="12" rx="3"/></svg>{{ t('byCategory') }}</h2><a class="shrink-0 text-xs font-bold text-pop-primary-dark" routerLink="/statistics">{{ t('viewAll') }} →</a></div>
            @if (app.balanceBusy()) { <p class="mt-4 text-sm" role="status">{{ t('loadingStatistics') }}</p> }
            @else if (app.balanceError()) { <p class="mt-4 text-sm" role="status">{{ t('balancesUnavailable') }}</p> }
            @else if (!app.dashboardCategories().length) { <p class="mt-4 text-sm text-pop-muted">{{ t('noRecentExpenses') }}</p> }
            @else { <div class="mt-4 flex flex-wrap items-center gap-4 sm:flex-nowrap"><div class="flex size-28 shrink-0 items-center justify-center rounded-full" [style.background]="app.dashboardDonut()" role="img" [attr.aria-label]="t('byCategory')"><div class="flex size-16 flex-col items-center justify-center rounded-full bg-white px-1 text-center"><strong class="text-[11px] font-black leading-tight">{{ app.groupSpent() }}</strong><small class="text-[9px] text-pop-muted">{{ t('totalLabel') }}</small></div></div><ul class="min-w-0 flex-1 text-xs">
              @for (item of app.dashboardCategories().slice(0, 4); track item.id; let i = $index) { <li class="flex min-h-7 items-center gap-1.5 border-b border-pop-border/60"><span aria-hidden="true">{{ categoryIcon(item.id) }}</span><span class="min-w-0 flex-1 truncate">{{ app.dashboardCategoryLabel(item) }}</span><strong>{{ categoryPercent(item.amountMinor) }} %</strong></li> }
              @if (hasOtherCategories()) { <li class="flex min-h-7 items-center gap-1.5"><span class="size-2 shrink-0 rounded-full bg-pop-border" aria-hidden="true"></span><span class="min-w-0 flex-1 truncate">{{ t('otherCategories') }}</span><strong>{{ categoryPercent(otherCategoryAmount()) }} %</strong></li> }
            </ul></div> }
          </section>
        </div>
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
        <section class="relative mt-6 overflow-hidden rounded-[1.8rem] border border-pop-border bg-white p-5 shadow-[0_12px_32px_#6455ec16] sm:p-7" [attr.aria-label]="t('gettingStarted')">
          <div class="grid gap-5">
            <div class="relative min-w-0 pb-1"><h2 class="text-2xl font-black lg:text-3xl">{{ t('gettingStarted') }} ✨</h2><p class="mt-3 max-w-lg text-sm leading-relaxed text-pop-muted lg:text-base">{{ t('gettingStartedIntro') }}</p></div>
            <ol class="grid gap-3 sm:grid-cols-3 lg:gap-4">
              <li class="min-w-0 rounded-[1.55rem] bg-gradient-to-br from-[#fff2ec] to-[#ffe8e5] p-5 text-center"><span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/75" aria-hidden="true"><svg width="53" height="53" viewBox="0 0 53 53" fill="none"><circle cx="17" cy="18" r="8" fill="#9B6AF5"/><circle cx="36" cy="18" r="8" fill="#FF9968"/><circle cx="26.5" cy="14" r="9" fill="#FF796E"/><path d="M4 42c0-9 6-15 13-15s13 6 13 15v2H4v-2Z" fill="#8056DF"/><path d="M23 42c0-9 6-15 13-15s13 6 13 15v2H23v-2Z" fill="#FFA15E"/><path d="M11 45c0-12 7-20 15.5-20S42 33 42 45v2H11v-2Z" fill="#E06AA6"/></svg></span><strong class="mt-3 block text-base font-black leading-snug">1. {{ t('stepGroup') }}</strong><p class="mt-2 text-sm leading-relaxed text-pop-muted">{{ t('stepGroupText') }}</p></li>
              <li class="min-w-0 rounded-[1.55rem] bg-gradient-to-br from-[#f7f0ff] to-[#eee8ff] p-5 text-center"><span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/75" aria-hidden="true"><svg width="53" height="53" viewBox="0 0 53 53" fill="none"><path d="M14 5h25v42l-5-3-5 3-5-3-5 3-5-3V5Z" fill="#9363F7"/><path d="M20 14h13M20 21h13M20 28h9" stroke="white" stroke-width="3" stroke-linecap="round"/><circle cx="37" cy="38" r="11" fill="#FFBE37"/><path d="M37 32v12m-4-9h7" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg></span><strong class="mt-3 block text-base font-black leading-snug">2. {{ t('stepExpense') }}</strong><p class="mt-2 text-sm leading-relaxed text-pop-muted">{{ t('stepExpenseText') }}</p></li>
              <li class="min-w-0 rounded-[1.55rem] bg-gradient-to-br from-[#fff9eb] to-[#fff1dd] p-5 text-center"><span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/75" aria-hidden="true"><svg width="53" height="53" viewBox="0 0 53 53" fill="none"><rect x="7" y="29" width="10" height="17" rx="3" fill="#7252BD"/><rect x="22" y="19" width="10" height="27" rx="3" fill="#A277F7"/><rect x="37" y="9" width="10" height="37" rx="3" fill="#8051F4"/><path d="m36 5 3-3m8 6 4-2" stroke="#FFBA29" stroke-width="3" stroke-linecap="round"/></svg></span><strong class="mt-3 block text-base font-black leading-snug">3. {{ t('stepBalance') }}</strong><p class="mt-2 text-sm leading-relaxed text-pop-muted">{{ t('stepBalanceText') }}</p></li>
            </ol>
          </div>
        </section>
      }
    </div>
  `,
})
export class DashboardPage {
  readonly app = inject(App);
  private readonly router = inject(Router);
  readonly t = t;
  search = '';
  memberBalanceLabel(value: bigint): string { return value > 0n ? t('receivable') : value < 0n ? t('payable') : t('balanced'); }
  searchExpenses(): void {
    const search = this.search.trim();
    if (search) void this.router.navigate(['/expenses'], { queryParams: { search } });
  }
  readonly categoryColorClass = categoryColorClass;
  categoryIcon(id: string): string { return categoryById(id).icon; }
  categoryPercent(amount: bigint): number {
    const total = this.app.dashboardCategories().reduce((sum, row) => sum + row.amountMinor, 0n);
    return total > 0n ? Number((amount * 100n + total / 2n) / total) : 0;
  }
  otherCategoryAmount(): bigint { return this.app.dashboardCategories().slice(4).reduce((sum, row) => sum + row.amountMinor, 0n); }
  hasOtherCategories(): boolean { return this.otherCategoryAmount() > 0n; }
}

@Component({
  imports: [FormsModule, GroupCurrencyPanel, GroupLifecyclePanel, GroupMetadataPanel, QrInvitationPanel, CategoryManager],
  template: `
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="relative overflow-hidden rounded-[1.8rem] bg-pop-primary px-6 py-7 text-white shadow-[0_12px_30px_#6455ec30] sm:min-h-52 sm:px-9 sm:py-10">
        <div class="relative z-10 max-w-[62%] sm:max-w-md"><p class="text-sm font-bold text-white/75">ourfinance. · {{ t('navGroups') }}</p><h1 class="mt-2 text-3xl font-black sm:text-4xl">{{ t('myGroups') }}</h1><p class="mt-3 text-sm text-white/90 sm:text-base">{{ t('groupsPageIntro') }}</p>
          @if (app.selectedGroup(); as selected) { <p class="mt-4 inline-flex max-w-full flex-wrap gap-1 rounded-full bg-white/15 px-3 py-2 text-sm font-bold"><span class="break-words">{{ selected.name }}</span><span>· {{ selected.currency }}</span></p> }
        </div>
        <img class="pointer-events-none absolute -bottom-5 -right-8 w-44 max-w-[55%] sm:bottom-[-3.5rem] sm:right-0 sm:w-80" src="/illustrations/friends-planning-trip.webp" alt="" />
      </header>
      @if (app.groups().length) {
        <section [attr.aria-label]="t('myGroups')"><div class="mb-3 flex items-center justify-between gap-3"><h2 class="text-xl font-black">{{ t('myGroups') }}</h2><span class="rounded-full bg-pop-lavender px-3 py-1 text-xs font-bold text-pop-primary-dark">{{ app.groups().length }}</span></div><div class="grid gap-3 sm:grid-cols-2">
          @for (group of app.groups(); track group.id) {
            <button class="flex min-h-24 items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-pop-primary" [class.border-pop-primary]="app.selectedGroupId() === group.id" [class.border-pop-border]="app.selectedGroupId() !== group.id" [attr.aria-pressed]="app.selectedGroupId() === group.id" type="button" (click)="app.selectedGroupId.set(group.id)">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pop-peach"><img class="h-9 w-9" [src]="$index % 2 ? '/illustrations/category-travel.svg' : '/illustrations/category-home.svg'" alt="" /></span><span class="min-w-0 flex-1"><strong class="block break-words">{{ group.name }}</strong><small class="text-pop-muted">{{ group.memberCount ?? 1 }} {{ t('membersCount') }}</small></span><span class="rounded-full bg-pop-lavender px-2 py-1 text-xs font-bold">{{ group.currency }}</span>
            </button>
          }
        </div></section>
      } @else { <p class="rounded-2xl border border-pop-border bg-white p-5 text-pop-muted">{{ t('noGroups') }} {{ t('gettingStartedIntro') }}</p> }
      @if (app.groupServiceReady() && app.auth?.user()?.emailVerified) {
        <form class="max-w-2xl space-y-4 rounded-[1.7rem] border border-pop-border bg-white p-5 shadow-sm sm:p-7" (ngSubmit)="app.createGroup()">
          <div class="flex items-center gap-3"><span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-pop-lavender text-2xl text-pop-primary" aria-hidden="true">＋</span><div><h2 class="text-xl font-black">{{ t('createGroup') }}</h2><p class="text-sm text-pop-muted">{{ t('groupCreateHelp') }}</p></div></div>
          <label class="block text-sm font-bold">{{ t('groupName') }}<input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border bg-pop-background px-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupName" [(ngModel)]="app.groupName" maxlength="80" required /></label>
          <label class="block text-sm font-bold">{{ t('groupCurrency') }}<select class="mt-1 min-h-11 w-full rounded-xl border border-pop-border bg-pop-background px-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupCurrency" [(ngModel)]="app.groupCurrency">@for (currency of app.currencies(); track currency.code) { <option [value]="currency.code">{{ currency.code }} · {{ currency.name }}</option> }</select></label>
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="block text-sm font-bold" for="group-icon">{{ metadataText().icon }} · {{ metadataText().optional }}</label>
              <select id="group-icon" class="mt-1 min-h-11 w-full rounded-xl border border-pop-border bg-pop-background px-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupIconId" [(ngModel)]="app.groupIconId">
                <option value="">{{ metadataText().none }}</option>
                @for (icon of icons; track icon.id) { <option [value]="icon.id">{{ metadataText().icons[$index] }}</option> }
              </select></div>
            <div><label class="block text-sm font-bold" for="group-color">{{ metadataText().color }} · {{ metadataText().optional }}</label>
              <select id="group-color" class="mt-1 min-h-11 w-full rounded-xl border border-pop-border bg-pop-background px-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupColor" [(ngModel)]="app.groupColor">
                <option value="">{{ metadataText().none }}</option>
                @for (color of colors; track color.id) { <option [value]="color.id">{{ metadataText().colors[$index] }}</option> }
              </select></div>
          </div>
          <div><label class="block text-sm font-bold" for="group-description">{{ metadataText().description }} · {{ metadataText().optional }}</label>
            <textarea id="group-description" class="mt-1 min-h-24 w-full rounded-xl border border-pop-border bg-pop-background p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupDescription" [(ngModel)]="app.groupDescription" maxlength="500"></textarea></div>
          <button class="min-h-12 w-full rounded-xl bg-pop-coral px-5 font-extrabold text-pop-text disabled:opacity-50 sm:w-auto" type="submit" [disabled]="app.busy() || !app.online()">+ {{ t('createGroup') }}</button>
        </form>
      } @else { <p class="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="status">{{ t('groupServiceMissing') }}</p> }
      @if (app.workerUrl && app.auth?.user(); as user) {
        @if (app.firebaseApp && app.selectedGroup(); as selected) { <app-group-lifecycle-panel [group]="selected" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onInvitationJoined()" /> }
        @if (app.firebaseApp && app.selectedGroup(); as selected) { <app-group-metadata-panel [group]="selected" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onInvitationJoined()" /> }
        @if (app.firebaseApp && app.groups().length) { <app-group-currency-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onInvitationJoined()" /> }
        <app-qr-invitation-panel [groups]="app.groups()" [user]="user" [workerUrl]="app.workerUrl" />
        @if (app.firebaseApp && app.groups().length) { <app-category-manager [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (changed)="app.onCategoryChanged()" /> }
      }
      @if (app.message()) { <p role="status">{{ app.message() }}</p> }
    </div>
  `,
})
export class GroupsPage {
  readonly app = inject(App);
  readonly t = t;
  readonly metadataText = computed(() => groupMetadataText[language()]);
  readonly icons = categoryIcons;
  readonly colors = categoryColors;
}

@Component({
  imports: [ExpenseForm, ExpenseHistory],
  template: `
    <div class="mx-auto max-w-5xl pb-20 xl:pb-0">
      <header class="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navExpenses') }}</h1></div>
        @if (app.groups().length && app.workerUrl && app.firebaseApp && app.auth?.user()) { <a class="hidden min-h-11 rounded-xl bg-pop-coral px-5 font-extrabold text-pop-text xl:inline-flex xl:items-center" href="#expense-editor">＋ {{ t('addExpenseAction') }}</a> }
        @if (showEditor()) { <button class="min-h-11 rounded-xl border border-pop-border bg-white px-4 font-bold text-pop-primary-dark xl:hidden" type="button" (click)="showEditor.set(false)">← {{ t('navExpenses') }}</button> }
      </header>
      @if (app.workerUrl && app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <app-expense-history class="min-w-0" [class.max-xl:hidden]="showEditor()" [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [firebaseApp]="app.firebaseApp" [user]="user" [workerUrl]="app.workerUrl" [revision]="app.expenseRevision()" [categoryRevision]="app.categoryRevision()" (commented)="app.onCommentAdded()" (editRequested)="app.onExpenseEdit($event); showEditor.set(true)" (deleted)="app.onExpenseSaved()" />
            <app-expense-form class="min-w-0" id="expense-editor" [class.max-xl:hidden]="!showEditor()" [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [categoryRevision]="app.categoryRevision()" [editing]="app.editingExpense()" (saved)="app.onExpenseSaved(); showEditor.set(false)" (editCancelled)="app.editingExpense.set(undefined); showEditor.set(false)" />
          </div>
          @if (!showEditor()) { <button class="fixed bottom-20 left-4 right-4 z-20 min-h-12 rounded-xl bg-pop-coral px-5 font-extrabold text-pop-text shadow-lg xl:hidden" type="button" (click)="showEditor.set(true)">＋ {{ t('addExpenseAction') }}</button> }
        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class ExpensesPage { readonly app = inject(App); readonly t = t; readonly showEditor = signal(false); }

@Component({
  imports: [StatisticsSummary, BalanceSummary, SettlementForm, SettlementHistory],
  template: `
    <div class="mx-auto max-w-5xl"><header class="mb-5"><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navStatistics') }}</h1></header>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          <app-statistics-summary [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" (groupChange)="app.selectedGroupId.set($event)" />
          <app-balance-summary [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" (groupChange)="app.selectedGroupId.set($event)" />
          @if (app.workerUrl) { <app-settlement-form [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (groupChange)="app.selectedGroupId.set($event)" (saved)="app.onSettlementSaved()" />
            <app-settlement-history [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [revision]="app.settlementRevision()" (groupChange)="app.selectedGroupId.set($event)" /> }
        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class StatisticsPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [ProfilePanel, ActivityHistory, ExportPanel, ImportPanel, RestorePanel, ReceiptCleanupPanel],
  template: `
    <div class="mx-auto max-w-5xl space-y-5"><h1 class="text-3xl font-black">{{ t('navAccount') }}</h1>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        <app-profile-panel [user]="user" [firebaseApp]="app.firebaseApp" />
        @if (app.groups().length) {
          <div id="activity"><app-activity-history [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [revision]="app.expenseRevision() + app.settlementRevision() + app.categoryRevision() + app.commentRevision()" /></div>
          <app-export-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
          @if (app.workerUrl) { <app-import-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
            <app-restore-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
            <app-receipt-cleanup-panel [groups]="app.groups()" [user]="user" [workerUrl]="app.workerUrl" /> }
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
