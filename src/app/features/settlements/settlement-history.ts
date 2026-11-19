import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
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
  imports: [FieldComponent, DropdownComponent, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="t('settlementHistory')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ t('settlementHistory') }}</h2>
      <app-field class="mt-5" controlId="settlementHistoryGroup" [label]="t('group')"><app-dropdown controlId="settlementHistoryGroup" [options]="groupDropdownOptions(groups, t('chooseGroup'), false)" name="settlementHistoryGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()" /></app-field>
      @if (selectedGroupId) {
        <app-ui-button variant="primary" class="mt-3" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</app-ui-button>
        @if (entries().length) {
          <ul class="mt-5 space-y-3">
            @for (entry of entries(); track entry.id) {
              <li class="rounded-2xl border border-pop-border bg-pop-surface p-4 text-sm shadow-sm">
                <div class="flex items-center justify-between gap-3"><span class="min-w-0 break-all font-bold">{{ memberLabel(entry.fromUserId) }} → {{ memberLabel(entry.toUserId) }}</span><span class="shrink-0 font-extrabold text-pop-primary-dark">{{ amount(entry) }}</span></div>
                <p class="mt-1 text-pop-muted">{{ displayDate(entry.date) }}</p>
              </li>
            }
          </ul>
          @if (hasMore()) { <app-ui-button variant="secondary" class="mt-3" type="button" [disabled]="busy()" (click)="loadMore()">{{ t('showMore') }}</app-ui-button> }
        } @else if (!busy() && !message()) { <p class="mt-5 rounded-2xl bg-pop-lavender p-5 text-sm text-pop-muted">{{ t('noSettlement') }}</p> }
      }
      @if (message()) { <app-ui-alert variant="info" class="mt-4">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class SettlementHistory implements OnChanges {
  readonly groupDropdownOptions = groupDropdownOptions;
  @Output() readonly groupChange = new EventEmitter<string>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
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
    if (this.selectedGroupId !== this.preferredGroupId && (!this.preferredGroupId || this.groups.some(group => group.id === this.preferredGroupId))) {
      this.selectedGroupId = this.preferredGroupId;
      void this.refresh();
    }
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  onGroupChange(): void { this.groupChange.emit(this.selectedGroupId); void this.refresh(); }
  amount(entry: SettlementHistoryEntry): string { return formatMinor(entry.amountMinor, entry.currency, locale()); }
  displayDate(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? t('me') : `${t('otherMember')} ${userId.slice(0, 8)}`; }
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
