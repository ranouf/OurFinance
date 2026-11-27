import { FieldComponent } from './shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from './shared/components/dropdown/dropdown.component';
import { currencyDropdownOptions } from './shared/components/dropdown/dropdown-options';
import { UiGroupCard } from './shared/components/ui-group-card/ui-group-card';
import { UiControlDirective } from './shared/components/ui-field/ui-control.directive';
import { UiButton } from './shared/components/ui-button/ui-button';
import { UiAlert } from './shared/components/ui-alert/ui-alert';
import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { App } from './app';
import { LoginPage } from './login-page';
import { groupMemberCountLabel, language, t } from './shared/utils/i18n';
import { categoryById, categoryColorClass, categoryColors, categoryIcons } from './shared/utils/categories';
import { categoryDropdownIcon } from './shared/utils/category-dropdown-options';
import { GroupOverview } from './features/groups/group-overview';
import { GroupCurrencyPanel } from './features/groups/group-currency-panel';
import { GroupLifecyclePanel } from './features/groups/group-lifecycle-panel';
import { GroupMetadataPanel } from './features/groups/group-metadata-panel';
import { groupMetadataText } from './features/groups/group-metadata-text';
import { groupsPageText } from './features/groups/groups-page-text';
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
import { validateInviteLink } from './core/firebase/pending-invite';

@Component({
  imports: [UiGroupCard, UiButton, UiAlert, RouterLink, GroupOverview, QrInvitationPanel],
  template: `
    <div class="mx-auto max-w-5xl">
      @if (app.groupsBusy()) {
        <app-ui-alert variant="info" class="mt-6">{{ t('loadingGroupList') }}</app-ui-alert>
      } @else if (app.groupsError()) {
        <app-ui-alert variant="error" class="mt-6">{{ t('groupsUnavailable') }}</app-ui-alert>
        <app-ui-button variant="outline" type="button" class="mt-3" (click)="app.refreshGroups()">{{ t('refresh') }}</app-ui-button>
      } @else if (app.selectedGroup(); as group) {
        <section class="dashboard-cloud relative mt-3 overflow-hidden rounded-[1.8rem] bg-pop-primary text-white shadow-[0_12px_30px_#6455ec30] sm:mt-5" [attr.aria-label]="t('myBalance')">
          <div class="relative h-44 sm:hidden">
            <img class="pointer-events-none h-full w-full object-cover object-[65%_55%]" src="/illustrations/cafe-hero-mobile.webp" alt="" />
          </div>
          <div class="relative z-10 bg-pop-primary px-4 py-4 sm:hidden">
            <p class="text-lg font-black">{{ group.name }} <span class="text-xs font-bold">· {{ group.currency }}</span></p>
            <div class="mt-2 flex -space-x-2" role="group" [attr.aria-label]="t('whoOwes')">@for (item of app.dashboardActiveMembers(); track item.userId) { @if (app.dashboardMemberName(item.userId); as name) { <span class="group relative flex size-9 items-center justify-center rounded-full border-2 border-white bg-pop-peach text-sm font-black text-pop-primary-dark shadow-md outline-none focus-visible:ring-2 focus-visible:ring-pop-sun" tabindex="0" [attr.aria-label]="name + ' · ' + memberBalanceLabel(item.balanceMinor) + ' ' + app.formatDashboardMinor(item.balanceMinor)">{{ name.slice(0, 1).toLocaleUpperCase() }}<span class="pointer-events-none absolute bottom-full left-0 mb-2 hidden min-w-max rounded-xl bg-pop-text px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block group-focus:block">{{ name }} · {{ memberBalanceLabel(item.balanceMinor) }} {{ app.formatDashboardMinor(item.balanceMinor) }}</span></span> } }</div>
            @if (app.balanceBusy()) { <app-ui-alert variant="info" class="mt-2">{{ t('loadingBalances') }}</app-ui-alert> }
            @else if (app.balanceError()) { <app-ui-alert variant="error" class="mt-2">{{ t('balancesUnavailable') }}</app-ui-alert> }
            @else { <p class="mt-2 text-xs text-white/85">{{ balancePhrase() }}</p><strong class="block text-2xl font-black">{{ balanceMagnitude() }}</strong>
              <div class="mt-3 grid grid-cols-3 gap-2 border-t border-white/25 pt-2 text-left"><div><span class="block text-[10px] text-white/80">{{ t('groupSpentThisMonth') }}</span><strong class="text-xs">{{ app.monthlySpent() }}</strong></div><div><span class="block text-[10px] text-white/80">{{ t('myShareThisMonth') }}</span><strong class="text-xs">{{ app.monthlyOwed() }}</strong></div><div><span class="block text-[10px] text-white/80">{{ t('paidByMeThisMonth') }}</span><strong class="text-xs">{{ app.monthlyPaid() }}</strong></div></div> }
          </div>
          <div class="hidden min-h-64 grid-cols-[52%_48%] sm:grid">
            <div class="relative overflow-hidden"><img class="absolute inset-0 h-full w-full object-cover object-[16%_45%]" src="/illustrations/cafe-hero-mobile.webp" alt="" /></div>
            <div class="flex min-w-0 flex-col justify-center px-5 py-6 lg:px-8"><p class="text-xs font-bold uppercase tracking-wider text-white">{{ t('myGroups') }} · {{ group.currency }}</p><h1 class="mt-1 break-words text-2xl font-black lg:text-3xl">{{ group.name }}</h1><p class="mt-1 text-sm text-white/80">{{ groupMemberCountLabel(group.memberCount ?? 1) }}</p>
              <div class="mt-2 flex -space-x-2" role="group" [attr.aria-label]="t('whoOwes')">@for (item of app.dashboardActiveMembers(); track item.userId) { @if (app.dashboardMemberName(item.userId); as name) { <span class="group relative flex size-9 items-center justify-center rounded-full border-2 border-white bg-pop-peach text-sm font-black text-pop-primary-dark shadow-md outline-none focus-visible:ring-2 focus-visible:ring-pop-sun" tabindex="0" [attr.aria-label]="name + ' · ' + memberBalanceLabel(item.balanceMinor) + ' ' + app.formatDashboardMinor(item.balanceMinor)">{{ name.slice(0, 1).toLocaleUpperCase() }}<span class="pointer-events-none absolute bottom-full left-0 mb-2 hidden min-w-max rounded-xl bg-pop-text px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block group-focus:block">{{ name }} · {{ memberBalanceLabel(item.balanceMinor) }} {{ app.formatDashboardMinor(item.balanceMinor) }}</span></span> } }</div>
              @if (app.balanceBusy()) { <app-ui-alert variant="info" class="mt-4">{{ t('loadingBalances') }}</app-ui-alert> } @else if (app.balanceError()) { <app-ui-alert variant="error" class="mt-4">{{ t('balancesUnavailable') }}</app-ui-alert> } @else { <p class="mt-4 text-xs text-white/85">{{ balancePhrase() }}</p><strong class="text-2xl lg:text-3xl">{{ balanceMagnitude() }}</strong><div class="mt-3 grid grid-cols-3 gap-2 border-t border-white/25 pt-2"><div><span class="block text-[10px] text-white/80">{{ t('groupSpentThisMonth') }}</span><strong class="text-sm">{{ app.monthlySpent() }}</strong></div><div><span class="block text-[10px] text-white/80">{{ t('myShareThisMonth') }}</span><strong class="text-sm">{{ app.monthlyOwed() }}</strong></div><div><span class="block text-[10px] text-white/80">{{ t('paidByMeThisMonth') }}</span><strong class="text-sm">{{ app.monthlyPaid() }}</strong></div></div> }
            </div>
          </div>
        </section>
        <div class="flex flex-col">
        <nav class="order-1 mt-5 grid gap-3 sm:grid-cols-3" [attr.aria-label]="t('quickActions')">
          <a class="dashboard-action dashboard-action-coral" routerLink="/expenses" [queryParams]="{ group: app.selectedGroupId(), action: 'add' }"><span class="dashboard-action-icon dashboard-action-icon-coral" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="5" stroke-linecap="round" /></svg></span><strong>{{ t('addExpenseAction') }}</strong></a>
          @if (app.auth?.user()?.uid === group.ownerId && app.workerUrl) { <button class="dashboard-action dashboard-action-lavender text-left" type="button" (click)="openInvite()"><span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/></svg></span><strong>{{ t('inviteQrAction') }}</strong><svg class="dashboard-action-qr" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M2 2h12v12H2zM22 2h12v12H22zM2 22h12v12H2z" stroke="currentColor" stroke-width="3"/><path d="M22 22h4v4h-4zM30 22h4v4h-4zM22 30h4v4h-4zM30 30h4v4h-4z" fill="currentColor"/></svg></button> } @else { <a class="dashboard-action dashboard-action-lavender" routerLink="/groups" fragment="qr-invitations"><span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/></svg></span><span><strong class="block">{{ t('inviteQrAction') }}</strong><small class="text-xs font-normal">{{ t('inviteOwnerHelp') }}</small></span></a> }
          <a class="dashboard-action dashboard-action-lavender" routerLink="/statistics" fragment="settlement-form"><span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M11 16h25l-6-6m6 6-6 6M37 32H12l6-6m-6 6 6 6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>{{ t('settleAction') }}</strong></a>
        </nav>
        <section class="order-2 mt-5 sm:order-3" [attr.aria-label]="t('myGroups')"><h2 class="mb-2 text-lg font-black">{{ t('myGroups') }}</h2><div class="flex max-w-full min-w-0 snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
          @for (item of app.groups(); track item.id) { <app-ui-group-card class="shrink-0 snap-start sm:w-full" [class.w-full]="app.groups().length === 1" [class.w-[80%]]="app.groups().length > 1" [name]="item.name" [detail]="groupMemberCountLabel(item.memberCount ?? 1) + ' · ' + item.currency" [amount]="app.formatGroupBalance(item)" [amountTone]="app.groupBalanceTone(item)" [icon]="categoryDropdownIcon(item.iconId || 'home') || 'house'" [selected]="app.selectedGroupId() === item.id" [interactive]="true" (activated)="app.requestGroupSelection(item.id)" /> }
        </div><a class="mt-2 flex min-h-11 items-center justify-center rounded-2xl bg-pop-lavender text-sm font-extrabold text-pop-primary-dark sm:hidden" routerLink="/groups">+ {{ t('createGroup') }}</a></section>
        <div class="order-3 mt-5 grid gap-4 sm:order-2 lg:grid-cols-3">
          <section class="order-2 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12] lg:order-1" [attr.aria-label]="t('whoOwes')">
            <h2 class="flex items-center gap-2 text-lg font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v17M5 7h14M4 7l-3 7h6L4 7Zm16 0-3 7h6l-3-7ZM7 20h10" /></svg>{{ t('whoOwes') }}</h2>
            @if (app.balanceBusy()) { <app-ui-alert variant="info" class="mt-4">{{ t('loadingBalances') }}</app-ui-alert> }
            @else if (app.balanceError()) { <app-ui-alert variant="error" class="mt-4">{{ t('balancesUnavailable') }}</app-ui-alert> }
            @else if ((group.memberCount ?? 1) <= 1) { <p class="mt-4 text-sm text-pop-muted">{{ t('dashboardPersonal') }}</p> }
            @else if (!app.dashboardSuggestedTransfers().length) { <p class="mt-4 text-sm text-pop-muted">{{ t('dashboardBalanced') }}</p> }
            @else { <p class="mt-2 text-xs text-pop-muted">{{ t('suggestedTransfers') }}</p><ul class="mt-3 divide-y divide-pop-border">
              @for (item of app.dashboardSuggestedTransfers(); track item.fromUserId + item.toUserId) {
                <li class="flex min-h-12 items-center gap-2 py-1.5 text-sm"><span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pop-peach to-pop-lavender font-black text-pop-primary-dark" aria-hidden="true">{{ app.dashboardMemberName(item.fromUserId).slice(0, 1).toLocaleUpperCase() }}</span><span class="min-w-0 flex-1 font-bold">{{ app.dashboardMemberName(item.fromUserId) }} {{ t('owes') }} {{ app.dashboardMemberName(item.toUserId) }}</span><strong class="shrink-0 rounded-full bg-pop-mint-soft px-2.5 py-1 text-xs text-emerald-700">{{ app.formatDashboardMinor(item.amountMinor) }}</strong></li>
              }
            </ul> }
          </section>
          <section class="order-1 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12] lg:order-2" [attr.aria-label]="t('recentExpenses')">
            <div class="flex items-center justify-between gap-2"><h2 class="flex min-w-0 items-center gap-2 text-lg font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>{{ t('recentExpenses') }}</h2><a class="shrink-0 text-xs font-bold text-pop-primary-dark" routerLink="/expenses">{{ t('viewAll') }} →</a></div>
            <div class="mt-3 divide-y divide-pop-border">
              @if (app.recentExpensesBusy()) { <app-ui-alert variant="info" class="py-3">{{ t('loadingExpenseHistory') }}</app-ui-alert> }
              @else if (app.recentExpensesError()) { <app-ui-alert variant="error" class="py-3">{{ t('historyUnavailable') }}</app-ui-alert> }
              @else if (!app.recentExpenses().length) { <p class="py-3 text-sm text-pop-muted">{{ t('noRecentExpenses') }}</p> }
              @else { @for (entry of app.recentExpenses(); track entry.id) { <a class="flex min-h-12 items-center gap-2 py-1.5 focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/expenses" [queryParams]="{ group: app.selectedGroupId(), expense: entry.id }" [fragment]="'expense-' + entry.id"><span class="flex size-9 shrink-0 items-center justify-center rounded-full text-lg" [class]="categoryColorClass(entry.categoryColor)" aria-hidden="true">{{ entry.categoryIcon }}</span><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ entry.description }}</strong><small class="text-pop-muted">{{ entry.date }}</small></span><strong class="shrink-0 text-xs text-pop-primary-dark">{{ app.formatRecentExpense(entry) }}</strong></a> } }
            </div>
          </section>
          <section class="order-3 min-w-0 rounded-[1.7rem] border border-pop-border bg-white p-4 shadow-[0_9px_25px_#6455ec12]" [attr.aria-label]="t('byCategory')">
            <div class="flex items-center justify-between gap-2"><h2 class="flex min-w-0 items-center gap-2 text-base font-black"><svg class="size-5 shrink-0 text-pop-primary-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="3"/><rect x="9" y="9" width="12" height="12" rx="3"/></svg>{{ t('byCategory') }}</h2><a class="shrink-0 text-xs font-bold text-pop-primary-dark" routerLink="/statistics">{{ t('viewAll') }} →</a></div><p class="mt-1 text-xs text-pop-muted">{{ t('monthlyExpenses') }}</p>
            @if (app.balanceBusy()) { <app-ui-alert variant="info" class="mt-4">{{ t('loadingStatistics') }}</app-ui-alert> }
            @else if (app.balanceError()) { <app-ui-alert variant="error" class="mt-4">{{ t('balancesUnavailable') }}</app-ui-alert> }
            @else if (!app.dashboardCategories().length) { <p class="mt-4 text-sm text-pop-muted">{{ t('noRecentExpenses') }}</p> }
            @else { <div class="mt-4 flex flex-wrap items-center gap-4 sm:flex-nowrap"><div class="flex size-28 shrink-0 items-center justify-center rounded-full" [style.background]="app.dashboardDonut()" role="img" [attr.aria-label]="t('byCategory')"><div class="flex size-16 flex-col items-center justify-center rounded-full bg-white px-1 text-center"><strong class="text-[11px] font-black leading-tight">{{ app.monthlySpent() }}</strong><small class="text-[9px] text-pop-muted">{{ t('totalLabel') }}</small></div></div><ul class="min-w-0 flex-1 text-xs">
              @for (item of app.dashboardCategories().slice(0, 4); track item.id; let i = $index) { <li class="flex min-h-7 items-center gap-1.5 border-b border-pop-border/60"><span aria-hidden="true">{{ categoryIcon(item.id) }}</span><span class="min-w-0 flex-1 truncate">{{ app.dashboardCategoryLabel(item) }}</span><strong>{{ categoryPercent(item.amountMinor) }} %</strong></li> }
              @if (hasOtherCategories()) { <li class="flex min-h-7 items-center gap-1.5"><span class="size-2 shrink-0 rounded-full bg-pop-border" aria-hidden="true"></span><span class="min-w-0 flex-1 truncate">{{ t('otherCategories') }}</span><strong>{{ categoryPercent(otherCategoryAmount()) }} %</strong></li> }
            </ul></div> }
          </section>
        </div>
        </div>
        @if (app.auth?.user(); as user) { <dialog #inviteDialog class="max-h-[90vh] w-[min(94vw,40rem)] overflow-y-auto rounded-3xl border border-pop-border bg-pop-background p-4 text-pop-text shadow-2xl backdrop:bg-pop-text/60 sm:p-6" [attr.aria-label]="t('inviteQrAction')" (close)="onInviteClosed()"><div class="flex items-center justify-between gap-3"><h2 class="text-xl font-black">{{ t('inviteQrAction') }}</h2><button class="flex size-11 items-center justify-center rounded-full bg-white text-xl focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-label]="t('closeDialog')" (click)="closeInvite()">×</button></div><app-qr-invitation-panel [groups]="[group]" [preferredGroupId]="group.id" [user]="user" [workerUrl]="app.workerUrl || ''" /></dialog> }
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
        <section class="mt-5 grid gap-3 sm:grid-cols-2" [attr.aria-label]="t('gettingStarted')">
          <form class="rounded-2xl border border-pop-border bg-white p-4" (submit)="joinFromLink($event)">
            <label class="block text-sm font-bold" for="dashboard-invite-link">{{ t('joinGroupAction') }}</label>
            <input id="dashboard-invite-link" class="mt-2 min-h-11 w-full rounded-xl border border-pop-border px-3 focus-visible:outline-2 focus-visible:outline-pop-primary" type="url" [value]="inviteLink" (input)="inviteLink = $any($event.target).value" [placeholder]="t('invitationLinkPlaceholder')" required />
            @if (inviteLinkError()) { <p class="mt-2 text-sm text-red-700" role="alert">{{ t('invitationLinkInvalid') }}</p> }
            <button class="mt-3 min-h-11 rounded-xl bg-pop-lavender px-4 font-bold text-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary" type="submit">{{ t('joinGroupAction') }}</button>
          </form>
          <div class="rounded-2xl border border-pop-border bg-white p-4"><h2 class="text-sm font-bold">{{ t('importExpensesAction') }}</h2><p class="mt-2 text-sm text-pop-muted">{{ t('importNeedsGroup') }}</p><a class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-pop-lavender px-4 font-bold text-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/groups" [queryParams]="{ intent: 'import' }">{{ t('createFirstGroup') }}</a></div>
        </section>
      }
    </div>
  `,
})
export class DashboardPage {
  readonly groupMemberCountLabel = groupMemberCountLabel;
  readonly app = inject(App);
  private readonly router = inject(Router);
  readonly t = t;
  inviteLink = '';
  readonly inviteLinkError = signal(false);
  joinFromLink(event: Event): void {
    event.preventDefault();
    try { window.location.assign(validateInviteLink(this.inviteLink.trim(), window.location.origin)); }
    catch { this.inviteLinkError.set(true); }
  }
  @ViewChild('inviteDialog') inviteDialog?: ElementRef<HTMLDialogElement>;
  private inviteTrigger?: HTMLElement;
  openInvite(): void { this.inviteTrigger = document.activeElement as HTMLElement; this.inviteDialog?.nativeElement.showModal(); }
  closeInvite(): void { this.inviteDialog?.nativeElement.close(); }
  onInviteClosed(): void { this.inviteTrigger?.focus(); }
  balancePhrase(): string { return this.app.selectedBalanceMinor() > 0n ? t('dashboardReceivable') : this.app.selectedBalanceMinor() < 0n ? t('dashboardPayable') : t('dashboardBalanced'); }
  balanceMagnitude(): string { return this.app.formatDashboardMinor(this.app.selectedBalanceMinor() < 0n ? -this.app.selectedBalanceMinor() : this.app.selectedBalanceMinor()); }
  search = '';
  memberBalanceLabel(value: bigint): string { return value > 0n ? t('receivable') : value < 0n ? t('payable') : t('balanced'); }
  searchExpenses(): void {
    const search = this.search.trim();
    void this.router.navigate(['/expenses'], { queryParams: { group: this.app.selectedGroupId(), ...(search ? { search } : {}) } });
  }
  readonly categoryColorClass = categoryColorClass;
  readonly categoryDropdownIcon = categoryDropdownIcon;
  categoryIcon(id: string): string { return categoryById(id).icon; }
  categoryPercent(amount: bigint): number {
    const total = this.app.dashboardCategories().reduce((sum, row) => sum + row.amountMinor, 0n);
    return total > 0n ? Number((amount * 100n + total / 2n) / total) : 0;
  }
  otherCategoryAmount(): bigint { return this.app.dashboardCategories().slice(4).reduce((sum, row) => sum + row.amountMinor, 0n); }
  hasOtherCategories(): boolean { return this.otherCategoryAmount() > 0n; }
}

@Component({
  imports: [FieldComponent, DropdownComponent, UiGroupCard, UiControlDirective, UiButton, UiAlert, FormsModule, RouterLink, GroupCurrencyPanel, GroupLifecyclePanel, GroupMetadataPanel, QrInvitationPanel, CategoryManager],
  templateUrl: './groups-page.html',
})
export class GroupsPage {
  readonly groupMemberCountLabel = groupMemberCountLabel;
  readonly app = inject(App);
  readonly t = t;
  readonly ux = computed(() => groupsPageText[language()]);
  readonly activeGroups = computed(() => this.app.groups().filter(group => group.status === 'active'));
  readonly archivedGroups = computed(() => this.app.groups().filter(group => group.status === 'archived'));
  readonly detailOpen = signal(false);
  readonly showCreate = signal(false);
  readonly showArchived = signal(false);
  readonly showJoin = signal(false);
  readonly tab = signal<'overview' | 'members' | 'categories' | 'settings'>('overview');
  readonly detailGroupId = signal('');
  readonly detailGroup = computed(() => this.app.groups().find(group => group.id === (this.detailGroupId() || this.app.selectedGroupId())));
  readonly tabs = computed(() => [
    { id: 'overview' as const, label: this.ux().overview },
    { id: 'members' as const, label: this.ux().members },
    { id: 'categories' as const, label: this.ux().categories },
    { id: 'settings' as const, label: this.ux().settings },
  ]);
  inviteLink = '';
  readonly inviteLinkError = signal(false);
  joinFromLink(event: Event): void {
    event.preventDefault();
    try { window.location.assign(validateInviteLink(this.inviteLink.trim(), window.location.origin)); }
    catch { this.inviteLinkError.set(true); }
  }
  openGroup(groupId: string): void { this.detailGroupId.set(groupId); this.detailOpen.set(true); this.tab.set('overview'); this.app.requestGroupSelection(groupId); }
  openArchived(groupId: string): void { this.detailGroupId.set(groupId); this.detailOpen.set(true); this.tab.set('overview'); }
  async createGroup(): Promise<void> {
    await this.app.createGroup();
    if (this.app.groupCreateFailed()) return;
    this.detailGroupId.set(this.app.selectedGroupId());
    this.detailOpen.set(true);
    this.showCreate.set(false);
  }
  readonly currencyDropdownOptions = currencyDropdownOptions;
  readonly categoryDropdownIcon = categoryDropdownIcon;
  readonly metadataText = computed(() => groupMetadataText[language()]);
  readonly iconOptions = computed<DropdownOption[]>(() => [
    { value: '', label: this.metadataText().none },
    ...categoryIcons.map((icon, index) => ({ value: icon.id, iconName: categoryDropdownIcon(icon.id), label: this.metadataText().icons[index] })),
  ]);
  readonly colorOptions = computed<DropdownOption[]>(() => [
    { value: '', label: this.metadataText().none },
    ...categoryColors.map((color, index) => ({ value: color.id, swatch: color.swatch, label: this.metadataText().colors[index] })),
  ]);
}

@Component({
  imports: [UiButton, ExpenseForm, ExpenseHistory],
  template: `
    <div class="mx-auto max-w-5xl pb-20 xl:pb-0">
      <header class="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navExpenses') }}</h1></div>
        @if (app.groups().length && app.workerUrl && app.firebaseApp && app.auth?.user()) { <a class="hidden min-h-11 rounded-xl bg-pop-coral px-5 font-extrabold text-pop-text xl:inline-flex xl:items-center" href="#expense-editor">＋ {{ t('addExpenseAction') }}</a> }
        @if (showEditor()) { <app-ui-button variant="secondary" class="xl:hidden" type="button" (click)="closeEditor()">← {{ t('navExpenses') }}</app-ui-button> }
      </header>
      @if (app.workerUrl && app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          @if (!showEditor()) { <app-ui-button variant="coral" size="lg" [block]="true" class="mb-5 block xl:hidden" type="button" (click)="showEditor.set(true)">＋ {{ t('addExpenseAction') }}</app-ui-button> }
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <app-expense-history class="min-w-0" [class.max-xl:hidden]="showEditor()" [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [firebaseApp]="app.firebaseApp" [user]="user" [workerUrl]="app.workerUrl" [revision]="app.expenseRevision()" [categoryRevision]="app.categoryRevision()" (groupChange)="app.requestGroupSelection($event)" (commented)="app.onCommentAdded()" (editRequested)="app.onExpenseEdit($event); showEditor.set(true)" (deleted)="app.onExpenseSaved()" />
            <app-expense-form class="min-w-0" id="expense-editor" [class.max-xl:hidden]="!showEditor()" [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [categoryRevision]="app.categoryRevision()" [editing]="app.editingExpense()" (groupChange)="app.requestGroupSelection($event)" (draftChanged)="app.expenseDraftActive.set($event)" (saved)="app.onExpenseSaved(); closeEditor()" (editCancelled)="app.editingExpense.set(undefined); app.expenseDraftActive.set(false); closeEditor()" />
          </div>

        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class ExpensesPage implements OnDestroy {
  readonly app = inject(App);
  readonly t = t;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly showEditor = signal(this.route.snapshot.queryParamMap.get('action') === 'add');
  private lastAction = this.route.snapshot.queryParamMap.get('action');
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const action = params.get('action');
      if (action === 'add' && action !== this.lastAction) this.showEditor.set(true);
      this.lastAction = action;
    });
  }
  closeEditor(): void {
    this.showEditor.set(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  ngOnDestroy(): void { this.app.expenseDraftActive.set(false); }
}

@Component({
  imports: [StatisticsSummary, BalanceSummary, SettlementForm, SettlementHistory],
  template: `
    <div class="mx-auto max-w-5xl"><header class="mb-5"><p class="text-sm font-bold text-pop-muted">{{ app.selectedGroup()?.name }} · {{ app.selectedGroup()?.currency }}</p><h1 class="text-3xl font-black">{{ t('navStatistics') }}</h1></header>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        @if (app.groups().length) {
          <app-statistics-summary [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" (groupChange)="app.requestGroupSelection($event)" />
          <app-balance-summary [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [revision]="app.expenseRevision() + app.settlementRevision()" (groupChange)="app.requestGroupSelection($event)" />
          @if (app.workerUrl) { <app-settlement-form id="settlement-form" [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" (groupChange)="app.requestGroupSelection($event)" (saved)="app.onSettlementSaved()" />
            <app-settlement-history [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [revision]="app.settlementRevision()" (groupChange)="app.requestGroupSelection($event)" /> }
        } @else { <p class="rounded-2xl bg-white p-5">{{ t('noGroups') }}</p> }
      }
    </div>
  `,
})
export class StatisticsPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [UiButton, ProfilePanel, ActivityHistory, ExportPanel, ImportPanel, RestorePanel, ReceiptCleanupPanel],
  template: `
    <div class="mx-auto max-w-5xl space-y-5"><h1 class="text-3xl font-black">{{ t('navAccount') }}</h1>
      @if (app.firebaseApp && app.auth?.user(); as user) {
        <app-profile-panel [user]="user" [firebaseApp]="app.firebaseApp" />
        @if (app.groups().length) {
          <div id="activity"><app-activity-history [groups]="app.groups()" [preferredGroupId]="app.selectedGroupId()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" [revision]="app.expenseRevision() + app.settlementRevision() + app.categoryRevision() + app.commentRevision()" (groupChange)="app.requestGroupSelection($event)" /></div>
          <app-export-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
          @if (app.workerUrl) { <app-import-panel id="import-expenses" [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
            <app-restore-panel [groups]="app.groups()" [user]="user" [firebaseApp]="app.firebaseApp" [workerUrl]="app.workerUrl" />
            <app-receipt-cleanup-panel [groups]="app.groups()" [user]="user" [workerUrl]="app.workerUrl" /> }
        }
      }
      <app-ui-button variant="secondary"  type="button" (click)="app.logout()">{{ t('logout') }}</app-ui-button>
    </div>
  `,
})
export class AccountPage { readonly app = inject(App); readonly t = t; }

@Component({
  imports: [InviteAcceptanceCard, LoginPage, UiButton, UiAlert],
  template: `
    @if (app.inviteJoinedNotice(); as notice) { <app-ui-alert variant="success" class="mx-auto mb-4 block max-w-5xl">{{ t(notice) }}</app-ui-alert> }
    @if (app.auth?.user(); as user) {
      @if (user.emailVerified && app.pendingInvite() && app.workerUrl) {
        <div class="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_#30275214] lg:grid lg:min-h-[620px] lg:grid-cols-[1.08fr_1fr]">
          <picture class="block overflow-hidden bg-pop-primary"><source media="(min-width: 1024px)" srcset="/illustrations/cafe-hero.webp" /><img class="h-52 w-full object-cover object-center lg:h-full" src="/illustrations/cafe-hero.webp" alt="" /></picture>
          <div class="flex items-center p-4 sm:p-8"><app-invite-acceptance-card class="block w-full" [user]="user" [workerUrl]="app.workerUrl" [token]="app.pendingInvite()!" (joined)="app.onQrJoined($event)" (declined)="app.declineInvite()" (changeAccount)="app.logout()" (invalidated)="app.invalidateInvite($event)" /></div>
        </div>
      } @else if (app.inviteTerminalError(); as reason) {
        <section class="mx-auto mt-6 max-w-xl rounded-3xl border border-pop-border bg-white p-6 shadow-sm" role="alert"><h1 class="text-2xl font-black">{{ app.qrText()[reason] }}</h1><app-ui-button variant="secondary" class="mt-4" type="button" (click)="app.declineInvite()">{{ app.qrText().decline }}</app-ui-button></section>
      } @else if (app.invalidInvite() || app.inviteStorageUnavailable()) {
        <section class="mx-auto mt-6 max-w-xl rounded-3xl border border-pop-border bg-white p-6 shadow-sm" role="alert"><h1 class="text-2xl font-black">{{ app.inviteStorageUnavailable() ? t('invitationStorageUnavailable') : t('invitationLinkInvalid') }}</h1><app-ui-button variant="secondary" class="mt-4" type="button" (click)="app.declineInvite()">{{ app.qrText().decline }}</app-ui-button></section>
      } @else { <section class="mx-auto mt-6 max-w-xl rounded-3xl border border-pop-border bg-white p-6 shadow-sm" role="status"><h1 class="text-2xl font-black">{{ t('invitationMissing') }}</h1><app-ui-button variant="secondary" class="mt-4" type="button" (click)="goBack()">{{ t('navHome') }}</app-ui-button></section> }
    } @else if (app.pendingInvite() || app.invalidInvite() || app.inviteStorageUnavailable()) { <app-login-page /> }
    @else { <section class="mx-auto mt-6 max-w-xl rounded-3xl border border-pop-border bg-white p-6 shadow-sm" role="status"><h1 class="text-2xl font-black">{{ t('invitationMissing') }}</h1><app-ui-button variant="secondary" class="mt-4" type="button" (click)="goBack()">{{ t('connection') }}</app-ui-button></section> }
  `,
})
export class JoinPage {
  readonly app = inject(App);
  readonly t = t;
  private readonly router = inject(Router);
  goBack(): void { void this.router.navigateByUrl(this.app.auth?.user() ? '/dashboard' : '/login'); }
}
