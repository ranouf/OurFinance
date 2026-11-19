import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { BalanceService } from '../../core/firebase/balance-service';
import type { Group } from '../../core/firebase/group-model';
import { formatMinorExact } from '../../shared/utils/currency';
import type { LedgerTotal } from '../../shared/utils/ledger';
import { locale, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-balance-summary',
  imports: [FieldComponent, DropdownComponent, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="t('groupBalances')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ t('groupBalances') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ t('balanceIntro') }}</p>
      <app-field class="mt-5" controlId="balanceGroup" [label]="t('group')"><app-dropdown controlId="balanceGroup" [options]="groupDropdownOptions(groups, t('chooseGroup'), false)" name="balanceGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()" /></app-field>
      @if (selectedGroupId) {
        <app-ui-button variant="primary" class="mt-3" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</app-ui-button>
        @for (currency of currencies(); track currency) {
          <div class="mt-5">
            <h3 class="font-extrabold text-pop-primary-dark">{{ currency }}</h3>
            <ul class="mt-3 grid gap-3 sm:grid-cols-2">
              @for (row of rowsFor(currency); track row.userId) {
                <li class="flex justify-between gap-3 rounded-2xl border border-pop-border bg-pop-lavender p-4 text-sm">
                  <span class="min-w-0 break-all font-bold">{{ memberLabel(row.userId) }}</span>
                  <span class="shrink-0 text-right"><strong class="text-lg text-pop-primary-dark">{{ amount(row) }}</strong><span class="block text-pop-muted">{{ label(row) }}</span></span>
                </li>
              }
            </ul>
          </div>
        } @empty { @if (!busy() && !message()) { <p class="mt-5 rounded-2xl bg-pop-lavender p-5 text-sm text-pop-muted">{{ t('noBalance') }}</p> } }
        @if (incompleteCount()) { <p class="mt-3 text-sm text-amber-800">{{ incompleteCount() }} {{ t('unknownShares') }}</p> }
      }
      @if (message()) { <app-ui-alert variant="info" class="mt-4">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class BalanceSummary implements OnChanges {
  readonly groupDropdownOptions = groupDropdownOptions;
  @Output() readonly groupChange = new EventEmitter<string>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly totals = signal<LedgerTotal[]>([]);
  readonly t = t;
  readonly incompleteCount = signal(0);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: BalanceService;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new BalanceService(this.firebaseApp);
    if (this.selectedGroupId !== this.preferredGroupId && (!this.preferredGroupId || this.groups.some(group => group.id === this.preferredGroupId))) {
      this.selectedGroupId = this.preferredGroupId;
      void this.refresh();
    }
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  onGroupChange(): void { this.groupChange.emit(this.selectedGroupId); void this.refresh(); }
  currencies(): string[] { return [...new Set(this.totals().map(row => row.currency))].sort(); }
  rowsFor(currency: string): LedgerTotal[] { return this.totals().filter(row => row.currency === currency); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? t('me') : `${t('otherMember')} ${userId.slice(0, 8)}`; }
  amount(row: LedgerTotal): string { return formatMinorExact(row.balanceMinor, row.currency, locale()); }
  label(row: LedgerTotal): string { return row.balanceMinor > 0n ? t('receivable') : row.balanceMinor < 0n ? t('payable') : t('balanced'); }
  async refresh(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.totals.set([]); this.incompleteCount.set(0); this.message.set('');
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const result = await this.service.load(groupId);
      if (requestId !== this.requestId) return;
      this.totals.set(result.totals); this.incompleteCount.set(result.incompleteCount);
    } catch { if (requestId === this.requestId) this.message.set(t('balancesUnavailable')); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
