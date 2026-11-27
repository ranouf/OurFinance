import { Component, HostListener, OnDestroy, OnInit, ViewChild, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AppShell } from './shared/components/app-shell/app-shell';
import { UiDialog } from './shared/components/ui-dialog/ui-dialog';
import type { AuthService } from './core/firebase/auth-service';
import { authDestination } from './core/firebase/auth-route';
import { FirebaseWebConfig, createFirebaseApp } from './core/firebase/firebase-config';
import type { GroupService } from './core/firebase/group-service';
import type { FirebaseApp } from 'firebase/app';
import { currencyCatalog } from './shared/utils/currency';
import { formatMinorExact } from './shared/utils/currency';
import { Group } from './core/firebase/group-model';
import { readPendingInvite, readInvalidInvite, clearPendingInvite } from './core/firebase/pending-invite';
import type { ExpenseHistoryEntry } from './core/firebase/expense-service';
import { dashboardMetrics } from './features/dashboard/dashboard-metrics';
import { accessibleGroupId, groupSelectionStorageKey } from './features/dashboard/group-selection';
import { loadSharedMemberProfiles } from './core/firebase/member-profile-service';
import { categoryLabel } from './shared/utils/category-label';
import { qrInvitationText } from './features/groups/qr-invitation-text';
import { detectLanguage, language, locale, setLanguage, t } from './shared/utils/i18n';

@Component({
  selector: 'app-root',
  imports: [AppShell, UiDialog, RouterOutlet],
  template: `
    @if (isComponentsGallery()) { <router-outlet /> }
    @else { <app-shell [signedIn]="!!auth?.user()" [hasGroups]="groups().length > 0" [groups]="groups()" [selectedGroupId]="selectedGroupId()" [showExpenseSearch]="!isExpensesRoute()" [userInitial]="userInitial()" [userName]="auth?.user()?.displayName || auth?.user()?.email || ''" [pageTitle]="pageTitle()" (groupSelected)="requestGroupSelection($event)" (searchRequested)="searchExpenses($event)" (signOut)="logout()">
      @if (!online()) { <p class="mx-auto max-w-6xl rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{{ t('offline') }}</p> }
      @if (state() === 'loading') { <p class="mx-auto max-w-6xl p-6" role="status">{{ t('loadingConfig') }}</p> }
      @else if (state() === 'unconfigured') { <p class="mx-auto max-w-6xl p-6" role="status">{{ t('missingConfig') }}</p> }
      @else if (!auth?.ready() || authRedirect()) {
        <div class="mx-auto flex min-h-[55vh] max-w-sm flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
          <img src="/illustrations/ourfinance-mark.svg" width="52" height="52" alt="" />
          <p class="mt-4 text-base font-bold text-pop-primary-dark">{{ t('loadingSession') }}</p>
          <span class="mt-4 h-1.5 w-28 overflow-hidden rounded-full bg-pop-lavender" aria-hidden="true"><span class="block h-full w-1/2 animate-pulse rounded-full bg-pop-primary"></span></span>
        </div>
      }
      @else { <router-outlet /> }
    </app-shell><app-ui-dialog #switchGroupDialog [title]="t('discardDraftTitle')" [closeLabel]="t('closeDialog')" (closed)="pendingGroupId.set(''); pendingExpenseEdit = undefined"><p class="text-sm">{{ t('discardDraftText') }}</p><div class="mt-4 flex justify-end gap-2"><button class="min-h-11 rounded-xl px-4 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="switchGroupDialog.close()">{{ t('keepDraft') }}</button><button class="min-h-11 rounded-xl bg-pop-coral px-4 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="confirmGroupSelection()">{{ t('discardDraft') }}</button></div></app-ui-dialog><app-ui-dialog #leaveExpenseDialog [title]="t('leaveDraftTitle')" [closeLabel]="t('closeDialog')" (closed)="onLeaveExpenseDialogClosed()"><p class="text-sm">{{ t('leaveDraftText') }}</p><div class="mt-4 flex justify-end gap-2"><button class="min-h-11 rounded-xl px-4 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="leaveExpenseDialog.close()">{{ t('keepDraft') }}</button><button class="min-h-11 rounded-xl bg-pop-coral px-4 font-bold focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="acceptLeaveExpensePage()">{{ t('leaveDraft') }}</button></div></app-ui-dialog> }
  `
})
export class App implements OnInit, OnDestroy {
  readonly t = t;
  readonly state = signal<'loading' | 'unconfigured' | 'ready'>('loading');
  readonly mode = signal<'login' | 'register' | 'reset'>('login');
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly groupCreateFailed = signal(false);
  readonly pendingInvite = signal<string | null>(null);
  readonly invalidInvite = signal(false);
  readonly inviteStorageUnavailable = signal(false);
  readonly inviteTerminalError = signal<'inviteExpired' | 'inviteFailed' | null>(null);
  readonly inviteJoinedNotice = signal<'invitationJoinedPrevious' | 'invitationJoinedOtherAccount' | null>(null);
  private readonly router = inject(Router);
  private readonly routeEvent = toSignal(this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)));
  readonly isComponentsGallery = computed(() => {
    this.routeEvent();
    return isDevMode() && (this.router.url.split('?')[0] === '/ui/components' || (typeof window !== 'undefined' && window.location.pathname === '/ui/components'));
  });
  readonly pageTitle = computed(() => {
    this.routeEvent();
    const path = this.router.url.split('?')[0];
    return path === '/groups' ? t('navGroups') : path === '/expenses' ? t('navExpenses') : path === '/statistics' ? t('navStatistics') : path === '/account' ? t('navAccount') : t('navHome');
  });
  readonly isExpensesRoute = computed(() => { this.routeEvent(); return this.router.url.split('?')[0] === '/expenses'; });
  readonly qrText = computed(() => qrInvitationText[language()]);
  readonly authRedirect = computed(() => {
    if (!this.routeEvent()) return null;
    if (this.isComponentsGallery()) return null;
    if (this.state() !== 'ready') return null;
    return authDestination(this.auth?.ready() ?? false, this.router.url.split(/[?#]/)[0], this.auth?.user() ?? null, !!this.pendingInvite() || this.invalidInvite() || this.inviteStorageUnavailable() || !!this.inviteTerminalError());
  });
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  @HostListener('window:online') onOnline(): void { this.online.set(true); }
  @HostListener('window:offline') onOffline(): void { this.online.set(false); }
  @HostListener('window:ourfinance:invite-changed') onInviteChanged(): void {
    if (typeof window === 'undefined') return;
    this.inviteTerminalError.set(null);
    this.syncStoredInvite(true);
    if (this.pendingInvite() || this.invalidInvite() || this.inviteStorageUnavailable()) void this.router.navigateByUrl('/join');
  }
  private syncStoredInvite(invitationChanged = false): void {
    try {
      this.pendingInvite.set(readPendingInvite(window.sessionStorage));
      this.invalidInvite.set(readInvalidInvite(window.sessionStorage));
      this.inviteStorageUnavailable.set(false);
    } catch {
      this.pendingInvite.set(null);
      this.invalidInvite.set(false);
      this.inviteStorageUnavailable.set(invitationChanged || window.location.pathname === '/join');
    }
  }
  auth?: AuthService;
  private groupService?: GroupService;
  firebaseApp?: FirebaseApp;
  workerUrl?: string;
  readonly currencies = computed(() => currencyCatalog(locale()));
  readonly groups = signal<Group[]>([]);
  readonly groupsBusy = signal(false);
  readonly groupsError = signal(false);
  readonly selectedGroupId = signal('');
  readonly selectedGroup = computed(() => this.groups().find(group => group.id === this.selectedGroupId()));
  readonly expenseDraftActive = signal(false);
  readonly pendingGroupId = signal('');
  pendingExpenseEdit?: { groupId: string; entry: ExpenseHistoryEntry };
  @ViewChild('switchGroupDialog') switchGroupDialog?: UiDialog;
  @ViewChild('leaveExpenseDialog') leaveExpenseDialog?: UiDialog;
  private leaveExpenseResolver?: (leave: boolean) => void;
  confirmLeaveExpensePage(): boolean | Promise<boolean> {
    if (!this.expenseDraftActive()) return true;
    return new Promise(resolve => { this.leaveExpenseResolver = resolve; this.leaveExpenseDialog?.open(); });
  }
  onLeaveExpenseDialogClosed(): void {
    const resolve = this.leaveExpenseResolver;
    this.leaveExpenseResolver = undefined;
    resolve?.(false);
  }
  acceptLeaveExpensePage(): void {
    const resolve = this.leaveExpenseResolver;
    this.leaveExpenseResolver = undefined;
    this.expenseDraftActive.set(false);
    this.leaveExpenseDialog?.close();
    resolve?.(true);
  }
  requestGroupSelection(groupId: string): void {
    if (groupId === this.selectedGroupId() || !this.groups().some(group => group.id === groupId)) return;
    if (this.expenseDraftActive()) { this.pendingGroupId.set(groupId); this.switchGroupDialog?.open(); return; }
    this.selectGroup(groupId);
  }
  confirmGroupSelection(): void {
    const groupId = this.pendingGroupId();
    const edit = this.pendingExpenseEdit;
    this.pendingExpenseEdit = undefined;
    this.switchGroupDialog?.close();
    if (!this.groups().some(group => group.id === groupId)) return;
    this.expenseDraftActive.set(false);
    this.selectGroup(groupId);
    if (edit) this.startExpenseEdit(edit);
  }
  searchExpenses(search: string): void { void this.router.navigate(['/expenses'], { queryParams: { group: this.selectedGroupId(), ...(search ? { search } : {}) } }); }
  private selectGroup(groupId: string): void {
    this.selectedGroupId.set(groupId);
    const userId = this.auth?.user()?.uid;
    if (userId && typeof window !== 'undefined') window.sessionStorage.setItem(groupSelectionStorageKey(userId), groupId);
    if (this.router.url.split('?')[0] === '/expenses') void this.router.navigate([], { queryParams: { group: groupId }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  readonly firstName = computed(() => { this.state(); return this.auth?.user()?.displayName?.trim().split(/\s+/)[0] ?? ''; });
  readonly userInitial = computed(() => { this.state(); return (this.auth?.user()?.displayName?.trim() || this.auth?.user()?.email || '?').charAt(0).toLocaleUpperCase(locale()); });
  readonly balanceBusy = signal(false);
  readonly balanceError = signal(false);
  readonly selectedBalanceMinor = signal<bigint>(0n);
  readonly groupSpentMinor = signal<bigint>(0n);
  readonly monthlySpentMinor = signal<bigint>(0n);
  readonly monthlyPaidMinor = signal<bigint>(0n);
  readonly monthlyOwedMinor = signal<bigint>(0n);
  readonly settlementTotalMinor = signal<bigint>(0n);
  readonly dashboardMemberBalances = signal<readonly { userId: string; balanceMinor: bigint }[]>([]);
  readonly dashboardSuggestedTransfers = signal<readonly { fromUserId: string; toUserId: string; amountMinor: bigint }[]>([]);
  readonly dashboardActiveMembers = signal<readonly { userId: string; balanceMinor: bigint }[]>([]);
  readonly dashboardGroupBalances = signal<Record<string, bigint>>({});
  formatGroupBalance(group: Group): string {
    const balance = this.dashboardGroupBalances()[group.id];
    return balance === undefined ? group.currency : formatMinorExact(balance, group.currency, locale());
  }
  groupBalanceTone(group: Group): 'positive' | 'negative' | 'neutral' {
    const balance = this.dashboardGroupBalances()[group.id] ?? 0n;
    return balance > 0n ? 'positive' : balance < 0n ? 'negative' : 'neutral';
  }
  readonly dashboardMemberNames = signal<Record<string, string>>({});
  dashboardMemberName(userId: string): string {
    if (userId === this.auth?.user()?.uid) return this.auth?.user()?.displayName?.trim() || t('me');
    return this.dashboardMemberNames()[userId] || `${t('otherMember')} ${this.dashboardActiveMembers().findIndex(item => item.userId === userId) + 1}`;
  }
  readonly dashboardCategories = signal<readonly { id: string; label?: string; amountMinor: bigint }[]>([]);
  readonly recentExpenses = signal<ExpenseHistoryEntry[]>([]);
  readonly recentExpensesBusy = signal(false);
  readonly recentExpensesError = signal(false);
  readonly selectedBalance = computed(() => this.selectedGroup() ? formatMinorExact(this.selectedBalanceMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly groupSpent = computed(() => this.selectedGroup() ? formatMinorExact(this.groupSpentMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly receivableAmount = computed(() => this.selectedGroup() ? formatMinorExact(this.selectedBalanceMinor() > 0n ? this.selectedBalanceMinor() : 0n, this.selectedGroup()!.currency, locale()) : '');
  readonly payableAmount = computed(() => this.selectedGroup() ? formatMinorExact(this.selectedBalanceMinor() < 0n ? -this.selectedBalanceMinor() : 0n, this.selectedGroup()!.currency, locale()) : '');
  readonly monthlySpent = computed(() => this.selectedGroup() ? formatMinorExact(this.monthlySpentMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly monthlyPaid = computed(() => this.selectedGroup() ? formatMinorExact(this.monthlyPaidMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly monthlyOwed = computed(() => this.selectedGroup() ? formatMinorExact(this.monthlyOwedMinor(), this.selectedGroup()!.currency, locale()) : '');
  readonly settlementTotal = computed(() => this.selectedGroup() ? formatMinorExact(this.settlementTotalMinor(), this.selectedGroup()!.currency, locale()) : '');
  formatDashboardMinor(value: bigint): string { return this.selectedGroup() ? formatMinorExact(value, this.selectedGroup()!.currency, locale()) : ''; }
  dashboardCategoryLabel(item: { id: string; label?: string }): string { return categoryLabel(item.id, language(), item.label); }
  readonly dashboardDonut = computed(() => {
    const rows = this.dashboardCategories().slice(0, 4);
    const total = this.dashboardCategories().reduce((sum, row) => sum + row.amountMinor, 0n);
    if (!total) return 'conic-gradient(#eee9ff 0 100%)';
    const colors = ['#6651ed', '#ff806e', '#ffc65e', '#67c9b3'];
    let offset = 0;
    const stops = rows.map((row, index) => {
      const next = offset + Number(row.amountMinor * 10000n / total) / 100;
      const stop = `${colors[index]} ${offset}% ${next}%`;
      offset = next;
      return stop;
    });
    if (offset < 100) stops.push(`#eee9ff ${offset}% 100%`);
    return `conic-gradient(${stops.join(',')})`;
  });
  formatRecentExpense(entry: ExpenseHistoryEntry): string { return formatMinorExact(BigInt(entry.amountMinor), entry.currency, locale()); }
  readonly balanceLabel = computed(() => this.selectedBalanceMinor() > 0n ? t('receivable') : this.selectedBalanceMinor() < 0n ? t('payable') : t('balanced'));
  private balanceRequestId = 0;
  private recentExpenseRequestId = 0;
  private groupLoadVersion = 0;
  private activeUserId: string | null = null;
  readonly expenseRevision = signal(0);
  readonly editingExpense = signal<{ groupId: string; entry: ExpenseHistoryEntry } | undefined>(undefined);
  readonly categoryRevision = signal(0);
  readonly settlementRevision = signal(0);
  readonly commentRevision = signal(0);
  readonly groupServiceReady = signal(false);
  groupName = '';
  groupCurrency = 'CAD';
  groupIconId = '';
  groupColor = '';
  groupDescription = '';

  constructor() {
    effect(() => {
      if (this.state() === 'ready') {
        const user = this.auth?.user();
        const userId = user?.uid ?? null;
        if (userId !== this.activeUserId) {
          this.clearSessionData();
          this.activeUserId = userId;
          setLanguage(detectLanguage(navigator.languages));
          if (user && this.firebaseApp) {
            const app = this.firebaseApp;
            void import('./core/firebase/profile-service')
              .then(({ ProfileService }) => new ProfileService(app).load(user))
              .then(profile => {
                if (this.auth?.user()?.uid === user.uid) setLanguage(profile.preferredLanguage);
              })
              .catch(() => { /* La langue du navigateur reste disponible hors ligne. */ });
          }
        }
        if (user?.emailVerified) void this.loadGroups();
      }
    });
    effect(() => {
      const group = this.selectedGroup();
      this.expenseRevision(); this.settlementRevision();
      if (group && this.firebaseApp && this.auth?.user()) {
        void this.loadSelectedBalance(group);
        void this.loadRecentExpenses(group);
      } else this.recentExpenses.set([]);
    });
    effect(() => {
      const destination = this.authRedirect();
      if (destination) void this.router.navigateByUrl(destination);
    });
    effect(() => {
      const event = this.routeEvent();
      if (event?.urlAfterRedirects.startsWith('/join#') && typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      }
    });
  }
  email = '';
  password = '';
  readonly heading = () => this.mode() === 'register' ? t('registerHeading') : this.mode() === 'reset' ? t('resetHeading') : t('welcome');

  async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') this.syncStoredInvite();
    setLanguage(language());
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration absente');
      const config = await response.json() as FirebaseWebConfig;
      if (config.projectId !== 'ourfinance-test') throw new Error('Projet non autorisé');
      const firebaseApp = createFirebaseApp(config);
      const [{ getAuth }, { AuthService }] = await Promise.all([
        import('firebase/auth'),
        import('./core/firebase/auth-service'),
      ]);
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
    const requestId = ++this.groupLoadVersion;
    this.groupsBusy.set(true);
    if (this.groupsError()) this.message.set('');
    this.groupsError.set(false);
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      const groups = await this.groupService.list(user);
      if (requestId !== this.groupLoadVersion || this.auth?.user()?.uid !== user.uid) return;
      this.groups.set(groups);
      this.dashboardGroupBalances.set({});
      void this.loadGroupBalances(groups, user.uid, requestId);
      const requestedGroupId = typeof window !== 'undefined' && window.location.pathname === '/expenses' ? new URLSearchParams(window.location.search).get('group') : null;
      const storedGroupId = typeof window !== 'undefined' ? window.sessionStorage.getItem(groupSelectionStorageKey(user.uid)) : null;
      this.selectedGroupId.set(accessibleGroupId(groups.map(group => group.id), requestedGroupId, this.selectedGroupId(), storedGroupId));
    }
    catch { if (requestId === this.groupLoadVersion && this.auth?.user()?.uid === user.uid) { this.groupsError.set(true); this.message.set(t('groupsUnavailable')); } }
    finally { if (requestId === this.groupLoadVersion) this.groupsBusy.set(false); }
  }
  private async loadGroupBalances(groups: readonly Group[], userId: string, requestId: number): Promise<void> {
    const { BalanceService } = await import('./core/firebase/balance-service');
    const service = new BalanceService(this.firebaseApp!);
    const balances = await Promise.allSettled(groups.map(async group => {
      const result = await service.load(group.id);
      return [group.id, result.totals.find(item => item.userId === userId && item.currency === group.currency)?.balanceMinor ?? 0n] as const;
    }));
    if (requestId !== this.groupLoadVersion || this.auth?.user()?.uid !== userId) return;
    this.dashboardGroupBalances.set(Object.fromEntries(balances.filter(result => result.status === 'fulfilled').map(result => result.value)));
  }
  private async loadSelectedBalance(group: Group): Promise<void> {
    const requestId = ++this.balanceRequestId;
    this.balanceBusy.set(true);
    this.balanceError.set(false);
    this.dashboardMemberBalances.set([]);
    this.dashboardSuggestedTransfers.set([]);
    this.dashboardActiveMembers.set([]);
    this.dashboardMemberNames.set({});
    try {
      const { BalanceService } = await import('./core/firebase/balance-service');
      const entries = await new BalanceService(this.firebaseApp!).entries(group.id);
      if (requestId !== this.balanceRequestId) return;
      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const metrics = dashboardMetrics(entries.expenses, entries.settlements, group.id, group.currency, this.auth?.user()?.uid ?? '', month);
      this.selectedBalanceMinor.set(metrics.balanceMinor);
      this.groupSpentMinor.set(metrics.groupSpentMinor);
      this.monthlySpentMinor.set(metrics.monthlySpentMinor);
      this.monthlyPaidMinor.set(metrics.monthlyPaidMinor);
      this.monthlyOwedMinor.set(metrics.monthlyOwedMinor);
      this.settlementTotalMinor.set(metrics.settlementTotalMinor);
      this.dashboardMemberBalances.set(metrics.memberBalances);
      this.dashboardSuggestedTransfers.set(metrics.suggestedTransfers);
      this.dashboardActiveMembers.set(metrics.memberBalances);
      this.dashboardCategories.set(metrics.categories);
      const currentUser = this.auth?.user();
      if (this.workerUrl && currentUser) {
        void loadSharedMemberProfiles(this.workerUrl, group.id, currentUser).then(profiles => {
          if (requestId === this.balanceRequestId) {
            this.dashboardMemberNames.set(Object.fromEntries(profiles.filter(item => item.displayName).map(item => [item.userId, item.displayName!])));
            if (profiles.length) this.dashboardActiveMembers.set((profiles.some(item => item.userId === currentUser.uid) ? profiles : [{ userId: currentUser.uid }, ...profiles])
              .map(item => ({ userId: item.userId, balanceMinor: metrics.memberBalances.find(balance => balance.userId === item.userId)?.balanceMinor ?? 0n })));
          }
        }).catch(() => { /* Names are optional until the protected profile route is available. */ });
      }
    } catch {
      if (requestId === this.balanceRequestId) this.balanceError.set(true);
    } finally {
      if (requestId === this.balanceRequestId) this.balanceBusy.set(false);
    }
  }
  private async loadRecentExpenses(group: Group): Promise<void> {
    const requestId = ++this.recentExpenseRequestId;
    const requestGroupId = group.id;
    this.recentExpensesBusy.set(true);
    this.recentExpensesError.set(false);
    try {
      const { ExpenseService } = await import('./core/firebase/expense-service');
      const result = await new ExpenseService(this.firebaseApp!, this.workerUrl ?? '').history(group.id);
      if (requestId === this.recentExpenseRequestId && this.selectedGroupId() === requestGroupId) this.recentExpenses.set(result.entries.slice(0, 3));
    } catch { if (requestId === this.recentExpenseRequestId && this.selectedGroupId() === requestGroupId) this.recentExpensesError.set(true); }
    finally { if (requestId === this.recentExpenseRequestId && this.selectedGroupId() === requestGroupId) this.recentExpensesBusy.set(false); }
  }
  async createGroup(): Promise<void> {
    const user = this.auth?.user();
    if (!user || !this.firebaseApp || this.busy()) return;
    this.busy.set(true); this.groupCreateFailed.set(false);
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      await this.groupService.create(user, this.groupName, this.groupCurrency, {
        ...(this.groupIconId ? { iconId: this.groupIconId } : {}),
        ...(this.groupColor ? { color: this.groupColor } : {}),
        ...(this.groupDescription.trim() ? { description: this.groupDescription.trim() } : {}),
      });
      this.groupName = ''; this.groupIconId = ''; this.groupColor = ''; this.groupDescription = '';
      await this.loadGroups();
      if (new URLSearchParams(this.router.url.split('?')[1] ?? '').get('intent') === 'import') void this.router.navigate(['/account'], { fragment: 'import-expenses' }); }
    catch { this.groupCreateFailed.set(true); }
    finally { this.busy.set(false); }
  }
  private clearSessionData(): void {
    this.groupLoadVersion++;
    this.groupCreateFailed.set(false);
    this.balanceRequestId++;
    this.recentExpenseRequestId++;
    this.email = '';
    this.password = '';
    this.groupName = '';
    this.groupCurrency = 'CAD';
    this.groupIconId = '';
    this.groupColor = '';
    this.groupDescription = '';
    this.expenseDraftActive.set(false);
    this.message.set('');
    this.groups.set([]);
    this.groupsBusy.set(false);
    this.groupsError.set(false);
    this.selectedGroupId.set('');
    this.selectedBalanceMinor.set(0n);
    this.groupSpentMinor.set(0n);
    this.monthlySpentMinor.set(0n);
    this.monthlyPaidMinor.set(0n);
    this.monthlyOwedMinor.set(0n);
    this.settlementTotalMinor.set(0n);
    this.dashboardMemberBalances.set([]);
    this.dashboardSuggestedTransfers.set([]);
    this.dashboardActiveMembers.set([]);
    this.dashboardGroupBalances.set({});
    this.dashboardMemberNames.set({});
    this.dashboardCategories.set([]);
    this.recentExpenses.set([]);
    this.recentExpensesBusy.set(false);
    this.recentExpensesError.set(false);
    this.balanceBusy.set(false);
    this.balanceError.set(false);
    this.editingExpense.set(undefined);
  }
  async logout(): Promise<void> { this.clearSessionData(); this.mode.set('login'); await this.auth?.logout(); await this.router.navigateByUrl('/login'); }
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
  clearStoredInvite(): void { if (typeof window !== 'undefined') { try { clearPendingInvite(window.sessionStorage); } catch { /* Le stockage peut être désactivé. */ } } }
  invalidateInvite(reason: 'inviteExpired' | 'inviteFailed'): void {
    this.clearStoredInvite();
    this.pendingInvite.set(null);
    this.inviteTerminalError.set(reason);
  }
  declineInvite(navigate = true): void {
    this.clearStoredInvite(); this.pendingInvite.set(null); this.invalidInvite.set(false); this.inviteStorageUnavailable.set(false); this.inviteTerminalError.set(null); this.inviteJoinedNotice.set(null);
    if (navigate) void this.router.navigateByUrl(this.auth?.user()?.emailVerified ? '/dashboard' : '/login');
  }
  async onQrJoined(result: { groupId: string; token: string; uid: string }): Promise<void> {
    if (this.auth?.user()?.uid !== result.uid) {
      this.inviteJoinedNotice.set('invitationJoinedOtherAccount');
      return;
    }
    if (this.pendingInvite() !== result.token) {
      await this.loadGroups();
      this.inviteJoinedNotice.set('invitationJoinedPrevious');
      return;
    }
    this.inviteJoinedNotice.set(null);
    this.declineInvite(false);
    await this.loadGroups();
    if (this.groups().some(group => group.id === result.groupId)) this.selectGroup(result.groupId);
    await this.router.navigateByUrl('/groups');
  }
  onExpenseSaved(): void { this.expenseRevision.update(value => value + 1); }
  onExpenseEdit(target: { groupId: string; entry: ExpenseHistoryEntry }): void {
    if (this.expenseDraftActive()) {
      this.pendingExpenseEdit = target;
      this.pendingGroupId.set(target.groupId);
      this.switchGroupDialog?.open();
      return;
    }
    this.startExpenseEdit(target);
  }
  private startExpenseEdit(target: { groupId: string; entry: ExpenseHistoryEntry }): void {
    this.editingExpense.set(target);
    this.selectGroup(target.groupId);
    void this.router.navigateByUrl('/expenses').then(() => requestAnimationFrame(() =>
      document.getElementById('expense-editor')?.scrollIntoView({ behavior: 'smooth' })));
  }
  onCategoryChanged(): void { this.categoryRevision.update(value => value + 1); }
  onSettlementSaved(): void { this.settlementRevision.update(value => value + 1); }
  onCommentAdded(): void { this.commentRevision.update(value => value + 1); }
  onInvitationJoined(): void { void this.loadGroups(); }
  refreshGroups(): void { void this.loadGroups(); }
}
