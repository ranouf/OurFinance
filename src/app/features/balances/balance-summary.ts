import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { BalanceService } from '../../core/firebase/balance-service';
import type { Group } from '../../core/firebase/group-model';
import { formatMinorExact } from '../../shared/utils/currency';
import type { LedgerTotal } from '../../shared/utils/ledger';

@Component({
  selector: 'app-balance-summary',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Soldes du groupe">
      <h2 class="text-lg font-semibold">Soldes du groupe</h2>
      <p class="mt-1 text-sm text-slate-600">Dépenses et remboursements déclarés, séparés par devise. Les imports historiques sans parts restent exclus.</p>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="balanceGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
        @for (currency of currencies(); track currency) {
          <div class="mt-4">
            <h3 class="font-semibold">{{ currency }}</h3>
            <ul class="mt-2 divide-y divide-slate-200">
              @for (row of rowsFor(currency); track row.userId) {
                <li class="flex justify-between gap-3 py-2 text-sm">
                  <span class="min-w-0 break-all">{{ memberLabel(row.userId) }}</span>
                  <span class="shrink-0 text-right"><strong>{{ amount(row) }}</strong><span class="block text-slate-600">{{ label(row) }}</span></span>
                </li>
              }
            </ul>
          </div>
        } @empty { @if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">Aucune opération à répartir dans ce groupe.</p> } }
        @if (incompleteCount()) { <p class="mt-3 text-sm text-amber-800">{{ incompleteCount() }} dépense(s) sans parts connues exclue(s) du calcul.</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class BalanceSummary implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly totals = signal<LedgerTotal[]>([]);
  readonly incompleteCount = signal(0);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: BalanceService;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new BalanceService(this.firebaseApp);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  currencies(): string[] { return [...new Set(this.totals().map(row => row.currency))].sort(); }
  rowsFor(currency: string): LedgerTotal[] { return this.totals().filter(row => row.currency === currency); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? 'Moi' : userId; }
  amount(row: LedgerTotal): string { return formatMinorExact(row.balanceMinor, row.currency, 'fr-CA'); }
  label(row: LedgerTotal): string { return row.balanceMinor > 0n ? 'À recevoir' : row.balanceMinor < 0n ? 'À payer' : 'Équilibré'; }
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
    } catch { if (requestId === this.requestId) this.message.set('Soldes indisponibles.'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
