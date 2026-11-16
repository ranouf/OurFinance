import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Group } from '../../core/firebase/group-model';
import { SettlementService, type SettlementHistoryEntry } from '../../core/firebase/settlement-service';
import { formatMinor } from '../../shared/utils/currency';
import { locale, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-settlement-history',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('settlementHistory')">
      <h2 class="text-lg font-semibold">{{ t('settlementHistory') }}</h2>
      <label class="mt-4 block text-sm font-medium">{{ t('group') }}
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="settlementHistoryGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">{{ t('chooseGroup') }}</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</button>
        @if (entries().length) {
          <ul class="mt-4 divide-y divide-slate-200">
            @for (entry of entries(); track entry.id) {
              <li class="py-3 text-sm">
                <div class="flex justify-between gap-3"><span class="min-w-0 break-all">{{ memberLabel(entry.fromUserId) }} → {{ memberLabel(entry.toUserId) }}</span><span class="shrink-0 font-semibold">{{ amount(entry) }}</span></div>
                <p class="mt-1 text-slate-600">{{ entry.date }}</p>
              </li>
            }
          </ul>
          @if (hasMore()) { <button class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">{{ t('showMore') }}</button> }
        } @else if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">{{ t('noSettlement') }}</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class SettlementHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl?: string;
  @Input() revision = 0;
  readonly entries = signal<SettlementHistoryEntry[]>([]);
  readonly t = t;
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: SettlementService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new SettlementService(this.firebaseApp, this.workerUrl);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  amount(entry: SettlementHistoryEntry): string { return formatMinor(entry.amountMinor, entry.currency, locale()); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? t('me') : userId; }
  async refresh(): Promise<void> { this.entries.set([]); this.last = undefined; this.hasMore.set(false); await this.load(); }
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
    } catch { if (requestId === this.requestId) this.message.set(t('historyUnavailable')); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
