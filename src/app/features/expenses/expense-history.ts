import { categoryDropdownOptions } from '../../shared/utils/category-dropdown-options';
import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { CategoryService } from '../../core/firebase/category-service';
import { ExpenseService, type ExpenseHistoryEntry } from '../../core/firebase/expense-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { loadSharedMemberProfiles } from '../../core/firebase/member-profile-service';
import { formatMinor } from '../../shared/utils/currency';
import { categories, categoryColorClass, type CategoryDefinition } from '../../shared/utils/categories';
import { categoryLabel } from '../../shared/utils/category-label';
import { language, locale } from '../../shared/utils/i18n';
import { CommentPanel } from './comment-panel';
import { matchesDescription } from './matches-description';
import { ReceiptPanel } from './receipt-panel';
import { expenseMessage, expenseText } from './expense-text';

@Component({
  selector: 'app-expense-history',
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule, ReceiptPanel, CommentPanel],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="text('history')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ text('history') }}</h2>
      <app-field class="mt-5 block" controlId="history-group" [label]="text('group')">
        <app-dropdown controlId="history-group" name="historyGroup" [options]="groupOptions()" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()" />
      </app-field>
      @if (selectedGroupId) {
        <app-field class="mt-4 block" controlId="history-category" [label]="text('category')">
          <app-dropdown controlId="history-category" name="historyCategory" [options]="categoryDropdownOptions()" [(ngModel)]="selectedCategoryId" (ngModelChange)="refresh()" />
        </app-field>
        <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label class="block min-w-0 flex-1 text-sm font-bold">{{ text('searchAll') }}
            <input appUiControl class="mt-2 w-full" type="search" name="historySearch" [(ngModel)]="search" [placeholder]="text('searchPlaceholder')" />
          </label>
          <app-ui-button variant="primary"  type="button" [disabled]="busy()" (click)="refresh()">{{ text('search') }}</app-ui-button>
        </div>
        <details class="mt-3 rounded-xl border border-pop-border px-4 py-3">
          <summary class="cursor-pointer text-sm font-bold text-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary">{{ text('moreFilters') }}</summary>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <label class="block text-sm font-bold">{{ text('from') }}
              <input appUiControl class="mt-2 w-full" type="date" name="historyFrom" [(ngModel)]="from" (ngModelChange)="refresh()" [attr.aria-invalid]="from && to && from > to ? 'true' : null" [attr.aria-describedby]="from && to && from > to ? 'history-date-error' : null" />
            </label>
            <label class="block text-sm font-bold">{{ text('to') }}
              <input appUiControl class="mt-2 w-full" type="date" name="historyTo" [(ngModel)]="to" (ngModelChange)="refresh()" [attr.aria-invalid]="from && to && from > to ? 'true' : null" [attr.aria-describedby]="from && to && from > to ? 'history-date-error' : null" />
            </label>
          </div>
          <app-field class="mt-3 block" controlId="history-participant" [label]="text('participant')">
            <app-dropdown controlId="history-participant" name="historyParticipant" [options]="participantDropdownOptions()" [(ngModel)]="selectedParticipantId" (ngModelChange)="refresh()" />
          </app-field>
          @if (from && to && from > to) { <p id="history-date-error" role="alert" class="mt-2 text-sm text-rose-700">{{ text('invalidDates') }}</p> }
        </details>
        @if (hasFilter()) { <p class="mt-2 text-sm text-pop-muted">{{ scannedCount() }} {{ text('scanned') }}</p> }
        @if (entries().length) {
          <ul class="mt-5 space-y-3">
            @for (entry of entries(); track entry.id) {
              <li [id]="'expense-' + entry.id" class="rounded-2xl border border-pop-border bg-pop-surface px-4 shadow-sm">
                <details [open]="opened().has(entry.id)" (toggle)="onToggle(entry.id, $event)">
                  <summary class="flex min-h-16 cursor-pointer items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-pop-primary">
                    <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl" [class]="categoryColorClass(entry.categoryColor)" aria-hidden="true">{{ entry.categoryIcon }}</span>
                    <span class="min-w-0 flex-1"><span class="block break-words font-bold">{{ entry.description }}</span><span class="block text-sm text-pop-muted">{{ displayDate(entry.date) }} · {{ categoryLabel(entry.categoryId, language(), entry.categoryLabel) }}</span></span>
                    <span class="shrink-0 text-right font-extrabold text-pop-primary-dark">{{ amount(entry) }}</span>
                  </summary>
                  <div class="grid gap-4 border-t border-pop-border pb-4 pt-4 text-sm">
                    <p>{{ text('category') }} : {{ categoryLabel(entry.categoryId, language(), entry.categoryLabel) }}</p>
                    @if (entry.createdBy === user?.uid) {
                      <div class="flex flex-wrap gap-2">
                        @if (entry.splitMode) { <app-ui-button variant="outline"  type="button" (click)="editRequested.emit({ groupId: selectedGroupId, entry })">{{ text('edit') }}</app-ui-button> }
                        <app-ui-button variant="outline"  type="button" (click)="deleteConfirmId.set(entry.id)">{{ text('remove') }}</app-ui-button>
                      </div>
                      @if (deleteConfirmId() === entry.id) {
                        <div class="flex flex-wrap items-center gap-2 rounded-xl bg-pop-peach p-3">
                          <span>{{ text('removePrompt') }}</span>
                          <app-ui-button variant="coral"  type="button" [disabled]="deleteBusy()" (click)="deleteExpense(entry)">{{ text('confirm') }}</app-ui-button>
                          <app-ui-button variant="secondary"  type="button" (click)="deleteConfirmId.set('')">{{ text('cancel') }}</app-ui-button>
                        </div>
                      }
                    }
                    <div>
                      <h3 class="font-semibold">{{ text('payments') }}</h3>
                      @for (payment of entry.payments; track payment.userId) {
                        <p class="mt-1 flex justify-between gap-2"><span class="min-w-0 break-all">{{ memberLabel(payment.userId) }}</span><span class="shrink-0">{{ format(payment.amountMinor, entry.currency) }}</span></p>
                      } @empty { <p class="mt-1 text-slate-600">{{ text('unavailable') }}</p> }
                    </div>
                    <div>
                      <h3 class="font-semibold">{{ text('owed') }}</h3>
                      @for (allocation of entry.allocations; track allocation.userId) {
                        <p class="mt-1 flex justify-between gap-2"><span class="min-w-0 break-all">{{ memberLabel(allocation.userId) }}</span><span class="shrink-0">{{ format(allocation.amountMinor, entry.currency) }}</span></p>
                      } @empty { <p class="mt-1 text-slate-600">{{ text('unavailable') }}</p> }
                    </div>
                    @if (opened().has(entry.id)) { <app-receipt-panel [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [user]="user" [groupId]="selectedGroupId" [expenseId]="entry.id" [groupOwnerId]="groupOwnerId()" /> }
                    @if (opened().has(entry.id)) { <app-comment-panel [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" [user]="user" [groupId]="selectedGroupId" [expenseId]="entry.id" [memberNames]="memberNames()" (changed)="commented.emit()" /> }
                  </div>
                </details>
              </li>
            }
          </ul>
        }
        @if (hasMore()) { <app-ui-button variant="secondary" class="mt-4" type="button" [disabled]="busy()" (click)="loadMore()">{{ hasFilter() ? text('continueSearch') : text('loadMore') }}</app-ui-button> }
        @if (!entries().length && !busy() && !message() && !(from && to && from > to)) { <p class="mt-5 rounded-2xl bg-pop-lavender p-5 text-center text-sm text-pop-muted">{{ hasMore() ? text('noPageResults') : text('noResults') }}</p> }
      }
      @if (message()) { <app-ui-alert [variant]="message() === 'deleted' ? 'success' : 'error'" class="mt-4">{{ displayMessage(message()) }}</app-ui-alert> }
    </section>
  `,
})
export class ExpenseHistory implements OnChanges {
  @Output() readonly commented = new EventEmitter<void>();
  @Output() readonly editRequested = new EventEmitter<{ groupId: string; entry: ExpenseHistoryEntry }>();
  @Output() readonly deleted = new EventEmitter<void>();
  @Output() readonly groupChange = new EventEmitter<string>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl?: string;
  @Input() revision = 0;
  @Input() categoryRevision = 0;
  readonly entries = signal<ExpenseHistoryEntry[]>([]);
  readonly categoryOptions = signal<readonly CategoryDefinition[]>(categories);
  readonly participantOptions = signal<readonly GroupMember[]>([]);
  readonly memberNames = signal<Record<string, string>>({});
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly scannedCount = signal(0);
  readonly opened = signal<ReadonlySet<string>>(new Set());
  readonly deleteConfirmId = signal('');
  readonly deleteBusy = signal(false);
  readonly text = expenseText;
  readonly displayMessage = expenseMessage;
  readonly categoryLabel = categoryLabel;
  readonly language = language;
  selectedGroupId = '';
  from = '';
  to = '';
  search = inject(ActivatedRoute).snapshot.queryParamMap.get('search') ?? '';
  private readonly targetExpenseId = inject(ActivatedRoute).snapshot.queryParamMap.get('expense') ?? '';
  searchTerm = '';
  selectedCategoryId = '';
  selectedParticipantId = '';
  private service?: ExpenseService;
  private categoryService?: CategoryService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;
  private filterRequestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) {
      this.service = new ExpenseService(this.firebaseApp, this.workerUrl);
      this.categoryService = new CategoryService(this.firebaseApp, this.workerUrl);
    }
    if (this.selectedGroupId !== this.preferredGroupId && this.groups.some(group => group.id === this.preferredGroupId)) {
      this.selectedGroupId = this.preferredGroupId;
      this.onGroupChange(false);
    }
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
    if (changes['categoryRevision'] && !changes['categoryRevision'].firstChange && this.selectedGroupId) void this.loadFilters();
  }

  amount(entry: ExpenseHistoryEntry): string { return this.format(entry.amountMinor, entry.currency); }
  format(amountMinor: number, currency: string): string { return formatMinor(amountMinor, currency, locale()); }
  displayDate(date: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)); }
  groupOptions(): DropdownOption[] { return [{ value: '', label: this.text('chooseGroup') }, ...this.groups.map(group => ({ value: group.id, label: group.name }))]; }
  categoryDropdownOptions(): DropdownOption[] { return categoryDropdownOptions(this.categoryOptions(), category => categoryLabel(category.id, language(), category.label), this.text('allCategories')); }
  participantDropdownOptions(): DropdownOption[] { return [{ value: '', label: this.text('allParticipants') }, ...this.participantOptions().map(member => ({ value: member.userId, label: this.memberLabel(member.userId) }))]; }
  memberLabel(userId: string): string { return userId === this.user?.uid ? this.text('me') : this.memberNames()[userId] || `${this.text('otherMember')} ${userId.slice(0, 8)}`; }
  groupOwnerId(): string { return this.groups.find(group => group.id === this.selectedGroupId)?.ownerId ?? ''; }
  onToggle(expenseId: string, event: Event): void {
    const next = new Set(this.opened());
    if ((event.target as HTMLDetailsElement).open) next.add(expenseId); else next.delete(expenseId);
    this.opened.set(next);
  }
  categoryColorClass = categoryColorClass;
  async deleteExpense(entry: ExpenseHistoryEntry): Promise<void> {
    if (!this.service || !this.user || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    try {
      await this.service.mutate(this.user, this.selectedGroupId, entry.id, 'DELETE', { expectedRevision: entry.revision });
      this.deleteConfirmId.set('');
      await this.refresh();
      this.message.set('deleted');
      this.deleted.emit();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'deleteFailed'); }
    finally { this.deleteBusy.set(false); }
  }
  hasFilter(): boolean { return !!(this.searchTerm || this.selectedCategoryId || this.selectedParticipantId); }
  onGroupChange(emit = true): void {
    if (emit) this.groupChange.emit(this.selectedGroupId);
    this.selectedCategoryId = '';
    this.selectedParticipantId = '';
    this.categoryOptions.set(categories);
    this.participantOptions.set([]);
    this.memberNames.set({});
    void this.loadFilters();
    void this.refresh();
  }

  private async loadFilters(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.filterRequestId;
    if (!groupId || !this.service || !this.categoryService) return;
    try {
      const [customCategories, members, names] = await Promise.all([
        this.categoryService.list(groupId), this.service.members(groupId),
        this.user && this.workerUrl ? loadSharedMemberProfiles(this.workerUrl, groupId, this.user).catch(() => []) : [],
      ]);
      if (requestId !== this.filterRequestId) return;
      this.categoryOptions.set([...categories, ...customCategories]);
      this.participantOptions.set(members);
      this.memberNames.set(Object.fromEntries(names.filter(item => item.displayName).map(item => [item.userId, item.displayName!])));
    } catch {
      if (requestId === this.filterRequestId) this.message.set('categoriesUnavailable');
    }
  }
  async refresh(): Promise<void> {
    this.searchTerm = this.search.trim();
    this.entries.set([]);
    this.opened.set(new Set());
    this.scannedCount.set(0);
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
      let cursor = this.last;
      let hasMore = false;
      const matches: ExpenseHistoryEntry[] = [];
      let scanned = 0;
      for (let pageNumber = 0; pageNumber < (this.hasFilter() ? 5 : 1); pageNumber++) {
        const page = await this.service.history(groupId, cursor, this.from, this.to);
        if (requestId !== this.requestId) return;
        matches.push(...page.entries.filter(entry =>
          (!this.searchTerm || matchesDescription(entry.description, this.searchTerm)) &&
          (!this.selectedCategoryId || entry.categoryId === this.selectedCategoryId) &&
          (!this.selectedParticipantId || entry.allocations.some(part => part.userId === this.selectedParticipantId))));
        scanned += page.scanned;
        cursor = page.last;
        hasMore = page.hasMore;
        if (!hasMore) break;
      }
      this.entries.update(entries => [...entries, ...matches]);
      if (matches.some(entry => entry.id === this.targetExpenseId)) this.opened.update(opened => new Set([...opened, this.targetExpenseId]));
      this.scannedCount.update(count => count + scanned);
      this.last = cursor;
      this.hasMore.set(hasMore);
    } catch {
      if (requestId === this.requestId) this.message.set('historyUnavailable');
    } finally {
      if (requestId === this.requestId) this.busy.set(false);
    }
  }
}
