import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { BalanceService } from '../../core/firebase/balance-service';
import type { Group } from '../../core/firebase/group-model';
import { formatMinorExact } from '../../shared/utils/currency';
import { calculateBalances, type ExpenseLedgerEntry, type SettlementLedgerEntry } from '../../shared/utils/ledger';
import { PeriodPicker, type AppliedRange } from './period-picker';
import { selectedRange } from './period-range';

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
  imports: [FormsModule, PeriodPicker],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Statistiques du groupe">
      <h2 class="text-lg font-semibold">Statistiques du groupe</h2>
      <p class="mt-1 text-sm text-slate-600">Dépenses et remboursements déclarés dans la devise du groupe. Les imports historiques sans parts restent exclus.</p>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="statisticsGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <app-period-picker [range]="range" (rangeChange)="setRange($event)" />
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
        @for (row of statistics(); track row.currency) {
          <div class="mt-4 border-t border-slate-200 pt-3 text-sm">
            <h3 class="font-semibold">{{ row.currency }}</h3>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <dt>Dépenses du groupe</dt><dd class="text-right font-medium">{{ amount(row.spentMinor, row.currency) }}</dd>
              <dt>Remboursements déclarés</dt><dd class="text-right font-medium">{{ amount(row.settledMinor, row.currency) }}</dd>
              <dt>Payé par moi</dt><dd class="text-right font-medium">{{ amount(row.myPaidMinor, row.currency) }}</dd>
              <dt>Ma part due</dt><dd class="text-right font-medium">{{ amount(row.myOwedMinor, row.currency) }}</dd>
              <dt>Mon solde</dt><dd class="text-right font-semibold">{{ amount(row.myBalanceMinor, row.currency) }}</dd>
            </dl>
          </div>
        } @empty { @if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">Aucune opération pour cette période.</p> } }
        @if (incompleteCount()) { <p class="mt-3 text-sm text-amber-800">{{ incompleteCount() }} dépense(s) du groupe sans parts connues, exclue(s) du calcul.</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class StatisticsSummary implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly statistics = signal<CurrencyStatistics[]>([]);
  readonly incompleteCount = signal(0);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  range: AppliedRange = selectedRange('months', new Date().toISOString().slice(0, 7), new Date().toISOString().slice(0, 7))!;
  private service?: BalanceService;
  private expenses: ExpenseLedgerEntry[] = [];
  private settlements: SettlementLedgerEntry[] = [];
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new BalanceService(this.firebaseApp);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  amount(value: bigint, currency: string): string { return formatMinorExact(value, currency, 'fr-CA'); }
  setRange(range: AppliedRange): void { this.range = range; this.recompute(); }
  async refresh(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.statistics.set([]); this.incompleteCount.set(0); this.message.set(''); this.expenses = []; this.settlements = [];
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const result = await this.service.entries(groupId);
      if (requestId !== this.requestId) return;
      this.expenses = result.expenses; this.settlements = result.settlements; this.incompleteCount.set(result.incompleteCount);
      this.recompute();
    } catch { if (requestId === this.requestId) this.message.set('Statistiques indisponibles.'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
  recompute(): void {
    if (!this.selectedGroupId) return;
    const totals = calculateBalances(this.expenses, this.settlements, this.range.start, this.range.end);
    const currencies = [...new Set(totals.map(row => row.currency))].sort();
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
