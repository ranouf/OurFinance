import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Group } from '../../core/firebase/group-model';
import { ExpenseService } from '../../core/firebase/expense-service';
import { formatMinor } from '../../shared/utils/currency';

interface HistoryEntry {
  id: string;
  description: string;
  date: string;
  amountMinor: number;
  currency: string;
}

@Component({
  selector: 'app-expense-history',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Historique des dépenses">
      <h2 class="text-lg font-semibold">Historique des dépenses</h2>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="historyGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
        @if (entries().length) {
          <ul class="mt-4 divide-y divide-slate-200">
            @for (entry of entries(); track entry.id) {
              <li class="flex min-w-0 items-start justify-between gap-3 py-3">
                <div class="min-w-0"><p class="break-words font-medium">{{ entry.description }}</p><p class="text-sm text-slate-600">{{ entry.date }}</p></div>
                <span class="shrink-0 font-semibold">{{ amount(entry) }}</span>
              </li>
            }
          </ul>
          @if (hasMore()) { <button class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">Afficher plus</button> }
        } @else if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">Aucune dépense dans ce groupe.</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ExpenseHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input() revision = 0;
  readonly entries = signal<HistoryEntry[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: ExpenseService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new ExpenseService(this.firebaseApp, this.workerUrl);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }

  amount(entry: HistoryEntry): string { return formatMinor(entry.amountMinor, entry.currency, 'fr-CA'); }

  async refresh(): Promise<void> {
    this.entries.set([]);
    this.last = undefined;
    this.hasMore.set(false);
    await this.load();
  }

  async loadMore(): Promise<void> { await this.load(); }

  private async load(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.message.set('');
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const page = await this.service.history(groupId, this.last);
      if (requestId !== this.requestId) return;
      this.entries.update(entries => [...entries, ...page.entries]);
      this.last = page.last;
      this.hasMore.set(page.hasMore);
    } catch {
      if (requestId === this.requestId) this.message.set('Historique indisponible.');
    } finally {
      if (requestId === this.requestId) this.busy.set(false);
    }
  }
}
