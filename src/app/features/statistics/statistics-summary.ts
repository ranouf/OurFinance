import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { BalanceService } from '../../core/firebase/balance-service';
import type { Group } from '../../core/firebase/group-model';
import { formatMinorExact } from '../../shared/utils/currency';
import { locale } from '../../shared/utils/i18n';
import { calculateBalances, type ExpenseLedgerEntry, type SettlementLedgerEntry } from '../../shared/utils/ledger';
import { chartData, type ChartData } from './chart-data';
import { PeriodPicker, type AppliedRange } from './period-picker';
import { selectedRange } from './period-range';
import { StatisticsCharts } from './statistics-charts';
import { statisticsText } from './statistics-text';

interface CurrencyStatistics {
  readonly currency: string;
  readonly spentMinor: bigint;
  readonly settledMinor: bigint;
  readonly myPaidMinor: bigint;
  readonly myOwedMinor: bigint;
  readonly myBalanceMinor: bigint;
}

@Component({
  selector: 'app-statistics-summary',
  imports: [FormsModule, PeriodPicker, StatisticsCharts],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="text('title')">
      <div class="mb-5 hidden h-1.5 w-14 rounded-full bg-pop-sun sm:block" aria-hidden="true"></div>
      <h2 class="sr-only text-2xl font-extrabold tracking-tight sm:not-sr-only">{{ text('title') }}</h2>
      <p class="sr-only mt-1 text-sm text-pop-muted sm:not-sr-only">{{ text('intro') }}</p>
      <div class="grid gap-3 sm:grid-cols-2 sm:items-end">
        @if (groups.length > 1) { <label class="mt-5 block text-sm font-bold">{{ text('group') }}
            <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="statisticsGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()">
              <option value="">{{ text('chooseGroup') }}</option>
              @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
            </select>
          </label> }
        @if (selectedGroupId) { <app-period-picker [range]="range" (rangeChange)="setRange($event)" /> }
      </div>
      @if (selectedGroupId) {
        <button class="mt-3 min-h-11 rounded-xl bg-pop-primary px-5 py-2 text-sm font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">{{ text('refresh') }}</button>
        @for (row of statistics(); track row.currency) {
          <div class="mt-5 border-t border-pop-border pt-5 text-sm">
            <h3 class="font-extrabold text-pop-primary-dark">{{ row.currency }}</h3>
            <dl class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <div class="rounded-2xl bg-pop-lavender p-4 max-[359px]:p-3"><dt class="text-pop-muted">{{ text('spent') }}</dt><dd class="mt-2 break-words text-2xl font-extrabold max-[359px]:text-lg">{{ amount(row.spentMinor, row.currency) }}</dd></div>
              <div class="rounded-2xl bg-pop-peach p-4 max-[359px]:p-3"><dt class="text-pop-muted">{{ text('paid') }}</dt><dd class="mt-2 break-words text-2xl font-extrabold max-[359px]:text-lg">{{ amount(row.myPaidMinor, row.currency) }}</dd></div>
              <div class="col-span-2 rounded-2xl bg-pop-mint-soft p-4 md:col-span-1"><dt class="text-pop-muted">{{ text('balance') }}</dt><dd class="mt-2 break-words text-2xl font-extrabold">{{ amount(row.myBalanceMinor, row.currency) }}</dd></div>
            </dl>
            @if (charts()[row.currency]; as chart) { <app-statistics-charts [data]="chart" [currency]="row.currency" [userId]="user?.uid ?? ''" /> }
            <details class="mt-3 rounded-xl border border-pop-border px-4 py-3"><summary class="cursor-pointer font-bold text-pop-primary-dark">{{ text('moreMeasures') }}</summary>
              <dl class="mt-3 grid gap-3 sm:grid-cols-2">
                <div><dt class="text-pop-muted">{{ text('settled') }}</dt><dd class="font-extrabold">{{ amount(row.settledMinor, row.currency) }}</dd></div>
                <div><dt class="text-pop-muted">{{ text('owed') }}</dt><dd class="font-extrabold">{{ amount(row.myOwedMinor, row.currency) }}</dd></div>
              </dl>
            </details>
          </div>
        } @empty { @if (!busy() && !message()) { <p class="mt-5 rounded-2xl bg-pop-lavender p-5 text-sm text-pop-muted">{{ text('empty') }}</p> } }
        @if (incompleteCount()) { <p class="mt-3 text-sm text-amber-800">{{ incompleteCount() }} {{ text('incomplete') }}</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ text('unavailable') }}</p> }
    </section>
  `,
})
export class StatisticsSummary implements OnChanges {
  @Output() readonly groupChange = new EventEmitter<string>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly statistics = signal<CurrencyStatistics[]>([]);
  readonly charts = signal<Record<string, ChartData>>({});
  readonly incompleteCount = signal(0);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  range: AppliedRange = { ...selectedRange('months', new Date().toISOString().slice(0, 7), new Date().toISOString().slice(0, 7))!, unit: 'months' };
  private service?: BalanceService;
  private expenses: ExpenseLedgerEntry[] = [];
  private settlements: SettlementLedgerEntry[] = [];
  private requestId = 0;
  readonly text = statisticsText;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new BalanceService(this.firebaseApp);
    if (this.selectedGroupId !== this.preferredGroupId && this.groups.some(group => group.id === this.preferredGroupId)) {
      this.selectedGroupId = this.preferredGroupId;
      void this.refresh();
    }
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  amount(value: bigint, currency: string): string { return formatMinorExact(value, currency, locale()); }
  onGroupChange(): void { this.groupChange.emit(this.selectedGroupId); void this.refresh(); }
  setRange(range: AppliedRange): void { this.range = range; this.recompute(); }
  async refresh(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.statistics.set([]); this.charts.set({}); this.incompleteCount.set(0); this.message.set(''); this.expenses = []; this.settlements = [];
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const result = await this.service.entries(groupId);
      if (requestId !== this.requestId) return;
      this.expenses = result.expenses; this.settlements = result.settlements; this.incompleteCount.set(result.incompleteCount);
      this.recompute();
    } catch { if (requestId === this.requestId) this.message.set('unavailable'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
  recompute(): void {
    if (!this.selectedGroupId) return;
    const totals = calculateBalances(this.expenses, this.settlements, this.range.start, this.range.end);
    const currencies = [...new Set(totals.map(row => row.currency))].sort();
    this.charts.set(Object.fromEntries(currencies.map(currency => [currency, chartData(this.expenses, this.settlements, currency, this.range.start, this.range.end, this.range.unit ?? 'months')])));
    this.statistics.set(currencies.map(currency => {
      const rows = totals.filter(row => row.currency === currency);
      const mine = rows.find(row => row.userId === this.user?.uid);
      return {
        currency,
        spentMinor: rows.reduce((sum, row) => sum + row.paidMinor, 0n),
        settledMinor: rows.reduce((sum, row) => sum + row.settlementsSentMinor, 0n),
        myPaidMinor: mine?.paidMinor ?? 0n,
        myOwedMinor: mine?.owedMinor ?? 0n,
        myBalanceMinor: mine?.balanceMinor ?? 0n,
      };
    }));
  }
}
