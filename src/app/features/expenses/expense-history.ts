import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Group } from '../../core/firebase/group-model';
import { ExpenseService, type ExpenseHistoryEntry } from '../../core/firebase/expense-service';
import { formatMinor } from '../../shared/utils/currency';

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
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="block text-sm font-medium">Du
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="historyFrom" [(ngModel)]="from" (ngModelChange)="refresh()" />
          </label>
          <label class="block text-sm font-medium">Au
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="historyTo" [(ngModel)]="to" (ngModelChange)="refresh()" />
          </label>
        </div>
        <label class="mt-3 block text-sm font-medium">Rechercher dans les dépenses chargées
          <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="search" name="historySearch" [(ngModel)]="search" placeholder="Description" />
        </label>
        @if (from && to && from > to) { <p class="mt-2 text-sm text-rose-700">La date de début doit précéder la date de fin.</p> }
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
        @if (filteredEntries().length) {
          <ul class="mt-4 divide-y divide-slate-200">
            @for (entry of filteredEntries(); track entry.id) {
              <li>
                <details>
                  <summary class="cursor-pointer py-3">
                    <span class="float-right ml-2 font-semibold">{{ amount(entry) }}</span>
                    <span class="break-words font-medium">{{ entry.description }}</span>
                    <span class="block text-sm text-slate-600">{{ entry.date }} · Voir les parts</span>
                  </summary>
                  <div class="grid gap-4 pb-4 text-sm">
                    <div>
                      <h3 class="font-semibold">Paiements</h3>
                      @for (payment of entry.payments; track payment.userId) {
                        <p class="mt-1 flex justify-between gap-2"><span class="min-w-0 break-all">{{ memberLabel(payment.userId) }}</span><span class="shrink-0">{{ format(payment.amountMinor, entry.currency) }}</span></p>
                      } @empty { <p class="mt-1 text-slate-600">Non disponibles.</p> }
                    </div>
                    <div>
                      <h3 class="font-semibold">Parts dues</h3>
                      @for (allocation of entry.allocations; track allocation.userId) {
                        <p class="mt-1 flex justify-between gap-2"><span class="min-w-0 break-all">{{ memberLabel(allocation.userId) }}</span><span class="shrink-0">{{ format(allocation.amountMinor, entry.currency) }}</span></p>
                      } @empty { <p class="mt-1 text-slate-600">Non disponibles.</p> }
                    </div>
                  </div>
                </details>
              </li>
            }
          </ul>
        }
        @if (hasMore()) { <button class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">Charger 20 dépenses de plus</button> }
        @if (!filteredEntries().length && !busy() && !message() && !(from && to && from > to)) { <p class="mt-4 text-sm text-slate-600">Aucune dépense correspondante dans les pages chargées.</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ExpenseHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl?: string;
  @Input() revision = 0;
  readonly entries = signal<ExpenseHistoryEntry[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  from = '';
  to = '';
  search = '';
  private service?: ExpenseService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new ExpenseService(this.firebaseApp, this.workerUrl);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }

  amount(entry: ExpenseHistoryEntry): string { return this.format(entry.amountMinor, entry.currency); }
  format(amountMinor: number, currency: string): string { return formatMinor(amountMinor, currency, 'fr-CA'); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? 'Moi' : userId; }
  filteredEntries(): ExpenseHistoryEntry[] {
    const term = this.search.trim().toLocaleLowerCase('fr-CA');
    return term ? this.entries().filter(entry => entry.description.toLocaleLowerCase('fr-CA').includes(term)) : this.entries();
  }

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
    if (!groupId || !this.service || (this.from && this.to && this.from > this.to)) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const page = await this.service.history(groupId, this.last, this.from, this.to);
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
