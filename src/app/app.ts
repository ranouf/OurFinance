import { Component, HostListener, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getAuth } from 'firebase/auth';
import { AppShell } from './shared/components/app-shell/app-shell';
import { AuthService } from './core/firebase/auth-service';
import { FirebaseWebConfig, createFirebaseApp } from './core/firebase/firebase-config';
import type { GroupService } from './core/firebase/group-service';
import type { FirebaseApp } from 'firebase/app';
import { currencyCodes } from './shared/utils/currency';
import { Group } from './core/firebase/group-model';
import { ExpenseForm } from './features/expenses/expense-form';
import { ExpenseHistory } from './features/expenses/expense-history';
import { SettlementForm } from './features/settlements/settlement-form';
import { SettlementHistory } from './features/settlements/settlement-history';
import { BalanceSummary } from './features/balances/balance-summary';
import { StatisticsSummary } from './features/statistics/statistics-summary';
import { ActivityHistory } from './features/activity/activity-history';
import { CategoryManager } from './features/categories/category-manager';
import { InvitationPanel } from './features/groups/invitation-panel';
import { ExportPanel } from './features/import-export/export-panel';
import { ProfilePanel } from './features/profile/profile-panel';
import { language, setLanguage, t } from './shared/utils/i18n';

@Component({
  selector: 'app-root',
  imports: [AppShell, FormsModule, ExpenseForm, ExpenseHistory, SettlementForm, SettlementHistory, BalanceSummary, StatisticsSummary, ActivityHistory, CategoryManager, InvitationPanel, ExportPanel, ProfilePanel],
  template: `
    <app-shell>
      <div class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 class="text-2xl font-bold">{{ heading() }}</h1>
        @if (!online()) { <p class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{{ t('offline') }}</p> }
        @if (state() === 'loading') {
          <p class="mt-4 text-slate-600" role="status">{{ t('loadingConfig') }}</p>
        } @else if (state() === 'unconfigured') {
          <p class="mt-4 text-slate-600" role="status">{{ t('missingConfig') }}</p>
        } @else if (auth?.user(); as user) {
          <p class="mt-4 text-slate-600">{{ t('connectedAs') }} {{ user.email }}.</p>
          @if (!user.emailVerified) {
            <p class="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900" role="status">{{ t('verifyEmail') }}</p>
          } @else {
            <section class="mt-6" [attr.aria-label]="t('myGroups')">
              <h2 class="text-lg font-semibold">{{ t('myGroups') }}</h2>
              @if (groups().length) {
                <ul class="mt-3 space-y-2">
                  @for (group of groups(); track group.id) {
                    <li class="rounded-lg border border-slate-200 p-3">{{ group.name }} · {{ group.currency }}</li>
                  }
                </ul>
              } @else { <p class="mt-2 text-slate-600">{{ t('noGroups') }}</p> }
              @if (groupServiceReady()) {
                <form class="mt-5 space-y-3" (ngSubmit)="createGroup()">
                  <label class="block text-sm">{{ t('groupName') }}
                    <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="groupName" [(ngModel)]="groupName" maxlength="80" required />
                  </label>
                  <label class="block text-sm">{{ t('groupCurrency') }}
                    <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="groupCurrency" [(ngModel)]="groupCurrency">
                      @for (currency of currencies; track currency) { <option [value]="currency">{{ currency }}</option> }
                    </select>
                  </label>
                  <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="submit" [disabled]="busy() || !online()">{{ t('createGroup') }}</button>
                </form>
              } @else { <p class="mt-4 text-sm text-amber-800">{{ t('groupServiceMissing') }}</p> }
            </section>
            @if (workerUrl) {
              @defer (on viewport) { <app-invitation-panel [groups]="groups()" [user]="user" [workerUrl]="workerUrl" (joined)="onInvitationJoined()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingInvites') }}</p> }
            }
            @if (workerUrl && firebaseApp && groups().length) {
              @defer (on viewport) { <app-category-manager [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (changed)="onCategoryChanged()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingCategories') }}</p> }
              @defer (on viewport) {
                <app-expense-form [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [categoryRevision]="categoryRevision()" (saved)="onExpenseSaved()" />
              } @placeholder {
                <p class="mt-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-600" role="status">{{ t('loadingExpense') }}</p>
              }
              @defer (on viewport) { <app-expense-history [groups]="groups()" [firebaseApp]="firebaseApp" [user]="user" [workerUrl]="workerUrl" [revision]="expenseRevision()" (commented)="onCommentAdded()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingExpenseHistory') }}</p> }
              @defer (on viewport) { <app-settlement-form [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (saved)="onSettlementSaved()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingSettlement') }}</p> }
              @defer (on viewport) { <app-settlement-history [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [revision]="settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingSettlementHistory') }}</p> }
              @defer (on viewport) { <app-balance-summary [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingBalances') }}</p> }
              @defer (on viewport) { <app-statistics-summary [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingStatistics') }}</p> }
              @defer (on viewport) { <app-activity-history [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [revision]="expenseRevision() + settlementRevision() + categoryRevision() + commentRevision()" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingActivity') }}</p> }
            }
            @if (firebaseApp && groups().length) {
              @defer (on viewport) {
                <app-export-panel [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" />
              } @placeholder {
                <p class="mt-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-600" role="status">{{ t('loadingExport') }}</p>
              }
            }
            @if (firebaseApp) {
              @defer (on viewport) { <app-profile-panel [user]="user" [firebaseApp]="firebaseApp" /> }
              @placeholder { <p class="mt-6 text-sm text-slate-600" role="status">{{ t('loadingProfile') }}</p> }
            }
          }
          <button class="mt-6 rounded-lg border border-slate-300 px-4 py-2" type="button" (click)="logout()">{{ t('logout') }}</button>
        } @else {
          <p class="mt-3 text-slate-600">{{ t('testSpace') }}</p>
          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <label class="block text-sm font-medium">{{ t('email') }}
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
            </label>
            @if (mode() !== 'reset') {
              <label class="block text-sm font-medium">{{ t('password') }}
                <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />
              </label>
            }
            <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" [disabled]="busy() || !online()" type="submit">
              {{ mode() === 'register' ? t('register') : mode() === 'reset' ? t('resetSend') : t('login') }}
            </button>
          </form>
          @if (mode() === 'login') {
            <button class="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 disabled:opacity-50" type="button" [disabled]="busy() || !online()" (click)="google()">{{ t('google') }}</button>
          }
          <div class="mt-5 flex gap-4 text-sm text-teal-700">
            <button type="button" (click)="mode.set('login')">{{ t('connection') }}</button>
            <button type="button" (click)="mode.set('register')">{{ t('signup') }}</button>
            <button type="button" (click)="mode.set('reset')">{{ t('forgotten') }}</button>
          </div>
        }
        @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
      </div>
    </app-shell>
  `,
})
export class App implements OnInit, OnDestroy {
  readonly t = t;
  readonly state = signal<'loading' | 'unconfigured' | 'ready'>('loading');
  readonly mode = signal<'login' | 'register' | 'reset'>('login');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  @HostListener('window:online') onOnline(): void { this.online.set(true); }
  @HostListener('window:offline') onOffline(): void { this.online.set(false); }
  auth?: AuthService;
  private groupService?: GroupService;
  firebaseApp?: FirebaseApp;
  workerUrl?: string;
  readonly currencies = currencyCodes();
  readonly groups = signal<Group[]>([]);
  readonly expenseRevision = signal(0);
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
  }
  email = '';
  password = '';
  readonly heading = () => this.mode() === 'register' ? t('registerHeading') : this.mode() === 'reset' ? t('resetHeading') : t('welcome');

  async ngOnInit(): Promise<void> {
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
      this.groups.set(await this.groupService.list(user));
    }
    catch { this.message.set(t('groupsUnavailable')); }
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
  onExpenseSaved(): void { this.expenseRevision.update(value => value + 1); }
  onCategoryChanged(): void { this.categoryRevision.update(value => value + 1); }
  onSettlementSaved(): void { this.settlementRevision.update(value => value + 1); }
  onCommentAdded(): void { this.commentRevision.update(value => value + 1); }
  onInvitationJoined(): void { void this.loadGroups(); }
}
