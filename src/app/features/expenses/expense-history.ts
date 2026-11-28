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
import { language, locale, usesSingular } from '../../shared/utils/i18n';
import { CommentPanel } from './comment-panel';
import { matchesDescription } from './matches-description';
import { ReceiptPanel } from './receipt-panel';
import { expenseMessage, expenseText, unnamedExpenseMember } from './expense-text';

@Component({
  selector: 'app-expense-history',
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule, ReceiptPanel, CommentPanel],
  templateUrl: './expense-history.html',
})
export class ExpenseHistory implements OnChanges {
  @Input() readOnly = false;
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
  readonly usesSingular = usesSingular;
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
  memberLabel(userId: string): string {
    if (userId === this.user?.uid) return this.text('me');
    return this.memberNames()[userId] || unnamedExpenseMember(userId, this.participantOptions());
  }
  groupOwnerId(): string { return this.groups.find(group => group.id === this.selectedGroupId)?.ownerId ?? ''; }
  isReadOnly(): boolean { return this.readOnly || this.groups.find(group => group.id === this.selectedGroupId)?.status === 'archived'; }
  onToggle(expenseId: string, event: Event): void {
    const next = new Set(this.opened());
    if ((event.target as HTMLDetailsElement).open) next.add(expenseId); else next.delete(expenseId);
    this.opened.set(next);
  }
  categoryColorClass = categoryColorClass;
  async deleteExpense(entry: ExpenseHistoryEntry): Promise<void> {
    if (!this.service || !this.user || this.deleteBusy() || this.isReadOnly()) return;
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
  resetFilters(): void {
    this.search = '';
    this.searchTerm = '';
    this.from = '';
    this.to = '';
    this.selectedCategoryId = '';
    this.selectedParticipantId = '';
    void this.refresh();
  }
  removeFilter(filter: 'search' | 'from' | 'to' | 'category' | 'participant'): void {
    if (filter === 'search') { this.search = ''; this.searchTerm = ''; }
    else if (filter === 'from') this.from = '';
    else if (filter === 'to') this.to = '';
    else if (filter === 'category') this.selectedCategoryId = '';
    else this.selectedParticipantId = '';
    void this.refresh();
  }
  categoryFilterLabel(): string { return this.categoryLabel(this.selectedCategoryId, this.language(), this.categoryOptions().find(item => item.id === this.selectedCategoryId)?.label ?? this.selectedCategoryId); }
  participantFilterLabel(): string { return this.memberLabel(this.selectedParticipantId); }
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
      this.entries.update(entries => {
        const seen = new Set(entries.map(entry => entry.id));
        const additions = matches.filter(entry => {
          if (seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        });
        return [...entries, ...additions];
      });
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
