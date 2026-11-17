import { Component, HostListener, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getAuth } from 'firebase/auth';
import { AppShell } from './shared/components/app-shell/app-shell';
import { AuthService } from './core/firebase/auth-service';
import { FirebaseWebConfig, createFirebaseApp } from './core/firebase/firebase-config';
import type { GroupService } from './core/firebase/group-service';
import type { FirebaseApp } from 'firebase/app';
import { currencyCatalog } from './shared/utils/currency';
import { formatMinorExact } from './shared/utils/currency';
import { Group } from './core/firebase/group-model';
import { capturePendingInvite, clearPendingInvite } from './core/firebase/pending-invite';
import { ExpenseForm } from './features/expenses/expense-form';
import { ExpenseHistory } from './features/expenses/expense-history';
import type { ExpenseHistoryEntry } from './core/firebase/expense-service';
import { SettlementForm } from './features/settlements/settlement-form';
import { SettlementHistory } from './features/settlements/settlement-history';
import { BalanceSummary } from './features/balances/balance-summary';
import { StatisticsSummary } from './features/statistics/statistics-summary';
import { ActivityHistory } from './features/activity/activity-history';
import { CategoryManager } from './features/categories/category-manager';
import { QrInvitationPanel } from './features/groups/qr-invitation-panel';
import { InviteAcceptanceCard } from './features/groups/invite-acceptance-card';
import { qrInvitationText } from './features/groups/qr-invitation-text';
import { GroupCurrencyPanel } from './features/groups/group-currency-panel';
import { GroupOverview } from './features/groups/group-overview';
import { ExportPanel } from './features/import-export/export-panel';
import { RestorePanel } from './features/import-export/restore-panel';
import { ProfilePanel } from './features/profile/profile-panel';
import { language, locale, setLanguage, t } from './shared/utils/i18n';

@Component({
  selector: 'app-root',
  imports: [AppShell, FormsModule, ExpenseForm, ExpenseHistory, SettlementForm, SettlementHistory, BalanceSummary, StatisticsSummary, ActivityHistory, CategoryManager, QrInvitationPanel, InviteAcceptanceCard, GroupCurrencyPanel, GroupOverview, ExportPanel, RestorePanel, ProfilePanel],
  template: `
    <app-shell [signedIn]="!!auth?.user()?.emailVerified && groups().length > 0">
      <div class="mx-auto" [class.max-w-5xl]="!!auth?.user()" [class.lg:grid]="!auth?.user()" [class.lg:grid-cols-2]="!auth?.user()" [class.lg:items-stretch]="!auth?.user()" [class.lg:gap-7]="!auth?.user()">
        @if (!auth?.user()) {
          <div class="mb-6 overflow-hidden rounded-[1.5rem] bg-pop-primary text-white lg:mb-0 lg:flex lg:flex-col lg:justify-between">
            <div class="px-6 pt-6 sm:px-9 lg:pt-10">
              <p class="text-sm font-extrabold uppercase tracking-[.18em] text-pop-sun">OurFinance</p>
              <h1 class="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{{ heading() }}</h1>
              <p class="mt-3 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">{{ t('testSpace') }}</p>
            </div>
            <picture>
              <source media="(min-width: 1024px)" srcset="/illustrations/cafe-terrace-desktop.svg" />
              <img class="h-32 w-full object-cover object-center sm:h-64 lg:h-80" src="/illustrations/cafe-terrace-mobile.svg" alt="" />
            </picture>
          </div>
        } @else {
          <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ heading() }}</h1>
        }
        <div [class.rounded-3xl]="!auth?.user()" [class.border]="!auth?.user()" [class.border-pop-border]="!auth?.user()" [class.bg-white]="!auth?.user()" [class.p-5]="!auth?.user()" [class.shadow-sm]="!auth?.user()" [class.sm:p-8]="!auth?.user()" [class.lg:mx-auto]="!auth?.user()" [class.lg:max-w-xl]="!auth?.user()">
        @if (!online()) { <p class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{{ t('offline') }}</p> }
        @if (state() === 'loading') {
          <p class="mt-4 text-slate-600" role="status">{{ t('loadingConfig') }}</p>
        } @else if (state() === 'unconfigured') {
          <p class="mt-4 text-slate-600" role="status">{{ t('missingConfig') }}</p>
        } @else if (auth?.user(); as user) {
          <p class="mt-3 break-all text-sm text-pop-muted">{{ t('connectedAs') }} {{ user.email }}.</p>
          @if (!user.emailVerified) {
            <p class="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900" role="status">{{ t('verifyEmail') }}</p>
            @if (pendingInvite()) {
              <p class="mt-2 text-sm">{{ qrText().verify }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button class="min-h-11 rounded-xl bg-pop-primary px-4 py-2 font-bold text-white disabled:opacity-50" type="button" [disabled]="busy()" (click)="refreshVerification()">{{ qrText().refreshVerification }}</button>
                <button class="min-h-11 rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="resendVerification()">{{ qrText().resendVerification }}</button>
              </div>
            }
          } @else {
            @if (pendingInvite()) {
              @if (workerUrl) {
                @defer (when pendingInvite()) { <app-invite-acceptance-card [user]="user" [workerUrl]="workerUrl" [token]="pendingInvite()!" (joined)="onQrJoined($event)" (declined)="declineInvite()" (changeAccount)="logout()" /> }
                @placeholder { <p class="mt-4" role="status">{{ qrText().loading }}</p> }
              }
            } @else {
            <section id="groups" tabindex="-1" class="mt-7" [attr.aria-label]="t('myGroups')">
              <div class="overflow-hidden rounded-[1.5rem] bg-pop-primary text-white shadow-[0_12px_30px_#6455ec30]">
                <div class="relative p-5 sm:p-7">
                  <img class="pointer-events-none absolute -right-4 -bottom-6 h-28 w-28 opacity-25" src="/illustrations/category-groceries.svg" alt="" />
                  <p class="relative text-sm font-semibold text-white/80">{{ t('myGroups') }}</p>
                  <h2 class="relative mt-2 break-words text-2xl font-extrabold sm:text-3xl">{{ selectedGroup()?.name || t('noGroups') }}</h2>
                  @if (selectedGroup(); as activeGroup) {
                    <p class="relative mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{{ activeGroup.currency }}</p>
                    <div class="relative mt-4">
                      <p class="text-xs font-semibold text-white/80">{{ t('myBalance') }}</p>
                      @if (balanceBusy()) {
                        <p class="mt-1 text-sm" role="status">{{ t('loadingBalances') }}</p>
                      } @else if (balanceError()) {
                        <p class="mt-1 text-sm" role="status">{{ t('balancesUnavailable') }}</p>
                      } @else {
                        <p class="mt-1 text-3xl font-extrabold">{{ selectedBalance() }}</p>
                        <p class="mt-1 text-xs font-semibold text-white/80">{{ balanceLabel() }}</p>
                      }
                    </div>
                  }
                  @if (selectedGroup()) {
                    <a class="relative mt-5 flex min-h-11 w-fit items-center rounded-xl bg-pop-coral px-4 font-extrabold text-pop-text focus-visible:outline-2 focus-visible:outline-white" href="#new-expense">{{ t('navAdd') }}</a>
                  } @else if (groupServiceReady()) {
                    <a class="relative mt-5 flex min-h-11 w-fit items-center rounded-xl bg-pop-coral px-4 font-extrabold text-pop-text focus-visible:outline-2 focus-visible:outline-white" href="#create-group">{{ t('createGroup') }}</a>
                  }
                </div>
              </div>
              <div class="mt-7 flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-xl font-extrabold">{{ t('myGroups') }}</h2>
                @if (groups().length > 1) {
                  <label class="text-sm font-semibold">{{ t('chooseGroup') }}
                    <select class="ml-2 min-h-11 max-w-full rounded-xl border border-pop-border bg-white px-3 text-pop-text" [ngModel]="selectedGroupId()" (ngModelChange)="selectedGroupId.set($event)">
                      @for (group of groups(); track group.id) { <option [value]="group.id">{{ group.name }}</option> }
                    </select>
                  </label>
                }
              </div>
              @if (groups().length) {
                <ul class="mt-4 grid gap-3 sm:grid-cols-2">
                  @for (group of groups(); track group.id) {
                    <li>
                      <button class="flex min-h-20 w-full min-w-0 items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-pop-primary" [class.border-pop-primary]="selectedGroupId() === group.id" [class.border-pop-border]="selectedGroupId() !== group.id" type="button" (click)="selectedGroupId.set(group.id)">
                        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pop-peach text-lg font-extrabold text-pop-primary-dark" aria-hidden="true">{{ group.name.slice(0, 1).toUpperCase() }}</span>
                        <span class="min-w-0 flex-1 break-words"><strong class="block">{{ group.name }}</strong>@if (group.memberCount !== undefined) { <span class="mt-1 block text-xs font-semibold text-pop-muted">{{ group.memberCount }} {{ group.memberCount === 1 ? t('memberCount') : t('membersCount') }}</span> }</span>
                        <span class="shrink-0 rounded-full bg-pop-lavender px-2.5 py-1 text-xs font-extrabold text-pop-primary-dark">{{ group.currency }}</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else { <p class="mt-2 text-slate-600">{{ t('noGroups') }}</p> }
              @if (selectedGroup(); as activeGroup) {
                @if (firebaseApp && auth?.user(); as activeUser) {
                  @defer (on viewport) {
                    <app-group-overview [group]="activeGroup" [firebaseApp]="firebaseApp" [user]="activeUser" [revision]="expenseRevision() + settlementRevision() + categoryRevision() + commentRevision()" />
                  } @placeholder {
                    <p class="mt-6 text-sm text-pop-muted" role="status">{{ t('loadingActivity') }}</p>
                  }
                }
              }
              @if (groupServiceReady()) {
                <form id="create-group" class="mt-6 space-y-3 rounded-2xl border border-pop-border bg-white p-5" (ngSubmit)="createGroup()">
                  <label class="block text-sm">{{ t('groupName') }}
                    <input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupName" [(ngModel)]="groupName" maxlength="80" required />
                  </label>
                  <label class="block text-sm">{{ t('groupCurrency') }}
                    <select class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="groupCurrency" [(ngModel)]="groupCurrency">
                      @for (currency of currencies(); track currency.code) { <option [value]="currency.code">{{ currency.code }} · {{ currency.name }} ({{ currency.symbol }}, {{ currency.minorDigits }})</option> }
                    </select>
                  </label>
                  <button class="min-h-11 rounded-xl bg-pop-primary px-5 py-2 font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="submit" [disabled]="busy() || !online()">{{ t('createGroup') }}</button>
                </form>
              } @else { <p class="mt-4 text-sm text-amber-800">{{ t('groupServiceMissing') }}</p> }
            </section>
            @if (workerUrl) {
              @if (firebaseApp && groups().length) {
                @defer (on viewport) { <app-group-currency-panel [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (changed)="onInvitationJoined()" /> }
                @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingGroupCurrency') }}</p> }
              }
              @defer (on viewport) { <app-qr-invitation-panel [groups]="groups()" [user]="user" [workerUrl]="workerUrl" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingInvites') }}</p> }
            }
            @if (workerUrl && firebaseApp && groups().length) {
              @defer (on viewport) { <app-category-manager [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (changed)="onCategoryChanged()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingCategories') }}</p> }
              <div id="new-expense" tabindex="-1">@defer (on viewport) {
                <app-expense-form id="expense-editor" [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [categoryRevision]="categoryRevision()" [editing]="editingExpense()" (saved)="onExpenseSaved()" (editCancelled)="editingExpense.set(undefined)" />
              } @placeholder {
                <p class="mt-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-600" role="status">{{ t('loadingExpense') }}</p>
              }</div>
              <div id="history" tabindex="-1">@defer (on viewport) { <app-expense-history [groups]="groups()" [firebaseApp]="firebaseApp" [user]="user" [workerUrl]="workerUrl" [revision]="expenseRevision()" [categoryRevision]="categoryRevision()" (commented)="onCommentAdded()" (editRequested)="onExpenseEdit($event)" (deleted)="onExpenseSaved()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingExpenseHistory') }}</p> }</div>
              @defer (on viewport) { <app-settlement-form [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (saved)="onSettlementSaved()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingSettlement') }}</p> }
              @defer (on viewport) { <app-settlement-history [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [revision]="settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingSettlementHistory') }}</p> }
              <div id="balances" tabindex="-1">@defer (on viewport) { <app-balance-summary [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingBalances') }}</p> }</div>
              @defer (on viewport) { <app-statistics-summary [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingStatistics') }}</p> }
              <div id="activity" tabindex="-1">@defer (on viewport) { <app-activity-history [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision() + categoryRevision() + commentRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingActivity') }}</p> }
              </div>
            }
            @if (firebaseApp && groups().length) {
              @defer (on viewport) {
                <app-export-panel [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" />
                @if (workerUrl) { <app-restore-panel [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" /> }
              } @placeholder {
                <p class="mt-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-600" role="status">{{ t('loadingExport') }}</p>
              }
            }
            @if (firebaseApp) {
              <div id="account" tabindex="-1">@defer (on viewport) { <app-profile-panel [user]="user" [firebaseApp]="firebaseApp" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingProfile') }}</p> }</div>
            }
            }
          }
          <button class="mt-6 rounded-lg border border-slate-300 px-4 py-2" type="button" (click)="logout()">{{ t('logout') }}</button>
        } @else {
          @if (pendingInvite()) {
            <aside class="mt-3 rounded-2xl bg-pop-lavender p-4 text-sm text-pop-text" role="status">
              <strong class="block">{{ qrText().received }}</strong>
              <span>{{ qrText().signIn }}</span>
              <button class="mt-2 block min-h-11 font-bold text-pop-primary-dark underline" type="button" (click)="declineInvite()">{{ qrText().decline }}</button>
            </aside>
          }
          <p class="mt-3 text-pop-muted">{{ t('testSpace') }}</p>
          <div class="mt-6 flex flex-wrap gap-1 rounded-xl bg-pop-lavender p-1 text-sm" role="group" [attr.aria-label]="t('welcome')">
            <button class="min-h-11 rounded-lg px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-pressed]="mode() === 'login'" [class.bg-white]="mode() === 'login'" [class.shadow-sm]="mode() === 'login'" (click)="mode.set('login')">{{ t('connection') }}</button>
            <button class="min-h-11 rounded-lg px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-pressed]="mode() === 'register'" [class.bg-white]="mode() === 'register'" [class.shadow-sm]="mode() === 'register'" (click)="mode.set('register')">{{ t('signup') }}</button>
            <button class="min-h-11 rounded-lg px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" [attr.aria-pressed]="mode() === 'reset'" [class.bg-white]="mode() === 'reset'" [class.shadow-sm]="mode() === 'reset'" (click)="mode.set('reset')">{{ t('forgotten') }}</button>
          </div>
          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <label class="block text-sm font-medium">{{ t('email') }}
              <input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
            </label>
            @if (mode() !== 'reset') {
              <label class="block text-sm font-medium">{{ t('password') }}
                <span class="mt-1 flex rounded-xl border border-pop-border focus-within:outline-2 focus-within:outline-pop-primary">
                  <input class="min-h-11 min-w-0 flex-1 rounded-xl p-3 outline-none" [type]="showPassword() ? 'text' : 'password'" name="password" [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'" [(ngModel)]="password" required />
                  <button class="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-pop-primary-dark" type="button" (click)="showPassword.update(value => !value)">{{ showPassword() ? t('hidePassword') : t('showPassword') }}</button>
                </span>
              </label>
            }
            <button class="min-h-12 w-full rounded-xl bg-pop-primary px-4 py-3 font-extrabold text-white hover:bg-pop-primary-dark disabled:opacity-50" [disabled]="busy() || !online()" type="submit">
              {{ mode() === 'register' ? t('register') : mode() === 'reset' ? t('resetSend') : t('login') }}
            </button>
          </form>
          @if (mode() === 'login') {
            <button class="mt-3 min-h-12 w-full rounded-xl border border-pop-border px-4 py-3 font-bold hover:bg-pop-lavender disabled:opacity-50" type="button" [disabled]="busy() || !online()" (click)="google()">{{ t('google') }}</button>
          }
        }
        @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
        </div>
      </div>
    </app-shell>
  `,
})
export class App implements OnInit, OnDestroy {
  readonly t = t;
  readonly state = signal<'loading' | 'unconfigured' | 'ready'>('loading');
  readonly mode = signal<'login' | 'register' | 'reset'>('login');
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly pendingInvite = signal<string | null>(null);
  readonly qrText = computed(() => qrInvitationText[language()]);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  @HostListener('window:online') onOnline(): void { this.online.set(true); }
  @HostListener('window:offline') onOffline(): void { this.online.set(false); }
  auth?: AuthService;
  private groupService?: GroupService;
  firebaseApp?: FirebaseApp;
  workerUrl?: string;
  readonly currencies = computed(() => currencyCatalog(locale()));
  readonly groups = signal<Group[]>([]);
  readonly selectedGroupId = signal('');
  readonly selectedGroup = computed(() => this.groups().find(group => group.id === this.selectedGroupId()));
  readonly balanceBusy = signal(false);
  readonly balanceError = signal(false);
  readonly selectedBalanceMinor = signal<bigint>(0n);
  readonly selectedBalance = computed(() => this.selectedGroup() ? formatMinorExact(this.selectedBalanceMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly balanceLabel = computed(() => this.selectedBalanceMinor() > 0n ? t('receivable') : this.selectedBalanceMinor() < 0n ? t('payable') : t('balanced'));
  private balanceRequestId = 0;
  readonly expenseRevision = signal(0);
  readonly editingExpense = signal<{ groupId: string; entry: ExpenseHistoryEntry } | undefined>(undefined);
  readonly categoryRevision = signal(0);
  readonly settlementRevision = signal(0);
  readonly commentRevision = signal(0);
  readonly groupServiceReady = signal(false);
  groupName = '';
  groupCurrency = 'CAD';

  constructor() {
    effect(() => {
      if (this.state() === 'ready') {
        const user = this.auth?.user();
        if (user?.emailVerified) void this.loadGroups();
      }
    });
    effect(() => {
      const group = this.selectedGroup();
      this.expenseRevision(); this.settlementRevision();
      if (group && this.firebaseApp && this.auth?.user()) void this.loadSelectedBalance(group);
    });
  }
  email = '';
  password = '';
  readonly heading = () => this.mode() === 'register' ? t('registerHeading') : this.mode() === 'reset' ? t('resetHeading') : t('welcome');

  async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') this.pendingInvite.set(capturePendingInvite(window.location, window.history, window.sessionStorage));
    setLanguage(language());
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration absente');
      const config = await response.json() as FirebaseWebConfig;
      if (config.projectId !== 'ourfinance-test') throw new Error('Projet non autorisé');
      const firebaseApp = createFirebaseApp(config);
      this.auth = new AuthService(getAuth(firebaseApp));
      this.firebaseApp = firebaseApp;
      this.workerUrl = config.workerUrl;
      this.groupServiceReady.set(!!config.workerUrl);
      this.state.set('ready');
    } catch { this.state.set('unconfigured'); }
  }
  ngOnDestroy(): void { this.auth?.destroy(); }
  async submit(): Promise<void> {
    if (!this.auth || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      if (this.mode() === 'register') { await this.auth.register(this.email, this.password); this.message.set(t('verifySent')); }
      else if (this.mode() === 'reset') { await this.auth.resetPassword(this.email); this.message.set(t('resetSent')); }
      else await this.auth.login(this.email, this.password);
    } catch { this.message.set(t('actionFailed')); }
    finally { this.busy.set(false); }
  }
  async google(): Promise<void> {
    if (!this.auth || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await this.auth.loginWithGoogle(); }
    catch { this.message.set(t('googleFailed')); }
    finally { this.busy.set(false); }
  }
  private async loadGroups(): Promise<void> {
    const user = this.auth?.user();
    if (!user || !this.firebaseApp) return;
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      const groups = await this.groupService.list(user);
      this.groups.set(groups);
      if (!groups.some(group => group.id === this.selectedGroupId())) this.selectedGroupId.set(groups[0]?.id ?? '');
    }
    catch { this.message.set(t('groupsUnavailable')); }
  }
  private async loadSelectedBalance(group: Group): Promise<void> {
    const requestId = ++this.balanceRequestId;
    this.balanceBusy.set(true);
    this.balanceError.set(false);
    try {
      const { BalanceService } = await import('./core/firebase/balance-service');
      const result = await new BalanceService(this.firebaseApp!).load(group.id);
      if (requestId !== this.balanceRequestId) return;
      this.selectedBalanceMinor.set(result.totals.find(row => row.userId === this.auth?.user()?.uid && row.currency === group.currency)?.balanceMinor ?? 0n);
    } catch {
      if (requestId === this.balanceRequestId) this.balanceError.set(true);
    } finally {
      if (requestId === this.balanceRequestId) this.balanceBusy.set(false);
    }
  }
  async createGroup(): Promise<void> {
    const user = this.auth?.user();
    if (!user || !this.firebaseApp || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      await this.groupService.create(user, this.groupName, this.groupCurrency); this.groupName = ''; await this.loadGroups(); }
    catch { this.message.set(t('groupCreateFailed')); }
    finally { this.busy.set(false); }
  }
  async logout(): Promise<void> { this.groups.set([]); await this.auth?.logout(); }
  async refreshVerification(): Promise<void> {
    this.busy.set(true);
    try { await this.auth?.refreshVerification(); }
    catch { this.message.set(t('actionFailed')); }
    finally { this.busy.set(false); }
  }
  async resendVerification(): Promise<void> {
    this.busy.set(true);
    try { await this.auth?.resendVerification(); this.message.set(t('verifySent')); }
    catch { this.message.set(t('actionFailed')); }
    finally { this.busy.set(false); }
  }
  declineInvite(): void { if (typeof window !== 'undefined') clearPendingInvite(window.sessionStorage); this.pendingInvite.set(null); }
  async onQrJoined(groupId: string): Promise<void> {
    this.declineInvite();
    await this.loadGroups();
    if (this.groups().some(group => group.id === groupId)) this.selectedGroupId.set(groupId);
  }
  onExpenseSaved(): void { this.expenseRevision.update(value => value + 1); }
  onExpenseEdit(target: { groupId: string; entry: ExpenseHistoryEntry }): void {
    this.editingExpense.set(target);
    setTimeout(() => document.getElementById('expense-editor')?.scrollIntoView({ behavior: 'smooth' }));
  }
  onCategoryChanged(): void { this.categoryRevision.update(value => value + 1); }
  onSettlementSaved(): void { this.settlementRevision.update(value => value + 1); }
  onCommentAdded(): void { this.commentRevision.update(value => value + 1); }
  onInvitationJoined(): void { void this.loadGroups(); }
}
