import { categoryDropdownOptions } from '../../shared/utils/category-dropdown-options';
import { FieldComponent } from '../../shared/components/field/field.component';
import { ControlErrorsComponent } from '../../shared/components/control-errors/control-errors.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiCheckboxDirective } from '../../shared/components/checkbox/ui-checkbox.directive';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChild, ViewChildren, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { ExpenseService } from '../../core/firebase/expense-service';
import type { ExpenseHistoryEntry } from '../../core/firebase/expense-service';
import { CategoryService } from '../../core/firebase/category-service';
import { loadSharedMemberProfiles } from '../../core/firebase/member-profile-service';
import { formatMinor, minorDigits } from '../../shared/utils/currency';
import { categories, type CustomCategory } from '../../shared/utils/categories';
import { categoryLabel } from '../../shared/utils/category-label';
import { language, locale } from '../../shared/utils/i18n';
import { parseMinor, prepareExpense, type ExpenseDraft } from './expense-draft';
import { expenseImpact } from './expense-impact';
import type { SplitMode } from '../../shared/utils/split-engine';
import { expenseMessage, expenseText, unnamedExpenseMember } from './expense-text';

@Component({
  selector: 'app-expense-form', imports: [FieldComponent, ControlErrorsComponent, DropdownComponent, UiCheckboxDirective, UiControlDirective, UiAlert, UiButton, FormsModule],
  templateUrl: './expense-form.html',
})
export class ExpenseForm implements OnChanges {
  readonly groupDropdownOptions = groupDropdownOptions;
  expenseCategoryOptions(): DropdownOption[] { return categoryDropdownOptions(this.availableCategories(), category => categoryLabel(category.id, language(), category.label)); }
  payerOptions(): DropdownOption[] { return this.members().map(member => ({ value: member.userId, label: this.memberLabel(member.userId) })); }
  splitModeOptions(): DropdownOption[] { return (['equal', 'exact', 'percentage', 'shares', 'adjustment'] as const).map(value => ({ value, label: this.text(value) })); }
  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  @ViewChild('descriptionInput') private descriptionInput?: ElementRef<HTMLInputElement>;
  @ViewChild('amountInput') private amountInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('paymentInput') private paymentInputs?: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('payerCheckbox') private payerCheckboxes?: QueryList<ElementRef<HTMLInputElement>>;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly editCancelled = new EventEmitter<void>();
  @Output() readonly groupChange = new EventEmitter<string>();
  @Output() readonly draftChanged = new EventEmitter<boolean>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input() categoryRevision = 0;
  @Input() editing?: { groupId: string; entry: ExpenseHistoryEntry };
  readonly categories = categories;
  readonly categoryLabel = categoryLabel;
  readonly language = language;
  readonly locale = locale;
  readonly formatMinor = formatMinor;
  readonly text = expenseText;
  readonly displayMessage = expenseMessage;
  readonly members = signal<{ userId: string }[]>([]);
  readonly memberNames = signal<Record<string, string>>({});
  readonly customCategories = signal<CustomCategory[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly paymentError = signal(false);
  readonly amountError = signal('');
  readonly descriptionError = signal(false);
  readonly previewRows = signal<{ userId: string; amountMinor: number }[]>([]);
  readonly splitEditorOpen = signal(false);
  readonly previousSplitUsed = signal(false);
  readonly draftDirty = signal(false);
  selectedGroupId = '';
  private groupRequestId = 0;
  draft: ExpenseDraft = this.emptyDraft();
  private service?: ExpenseService;
  private categoryService?: CategoryService;
  private pendingKey?: string;
  private pendingBody?: string;
  markDraft(): void { this.draftDirty.set(true); this.draftChanged.emit(true); }
  discardDraft(): void { void this.loadGroup(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) {
      this.service = new ExpenseService(this.firebaseApp, this.workerUrl);
      this.categoryService = new CategoryService(this.firebaseApp, this.workerUrl);
    }
    if (!this.editing && this.selectedGroupId !== this.preferredGroupId && this.groups.some(group => group.id === this.preferredGroupId)) {
      this.selectedGroupId = this.preferredGroupId;
      void this.loadGroup();
    }
    if (changes['categoryRevision'] && !changes['categoryRevision'].firstChange && this.selectedGroupId) void this.loadCategories().catch(() => this.message.set('categoriesUnavailable'));
    if (changes['editing']) {
      if (this.editing) this.selectedGroupId = this.editing.groupId;
      void this.loadGroup();
    }
  }
  availableCategories() { return [...categories, ...this.customCategories().filter(category => category.status === 'active' || category.id === this.editing?.entry.categoryId)]; }
  private async loadCategories(): Promise<void> {
    const groupId = this.selectedGroupId;
    if (!groupId || !this.categoryService) return;
    const items = await this.categoryService.list(groupId);
    if (this.selectedGroupId !== groupId) return;
    this.customCategories.set(items);
    if (!this.availableCategories().some(category => category.id === this.draft.categoryId)) this.draft.categoryId = 'other';
  }
  private emptyDraft(): ExpenseDraft { return { description: '', amount: '', currency: 'CAD', date: new Date().toISOString().slice(0, 10), categoryId: 'other', payerId: '', multiplePayers: false, paymentRows: [], kind: 'equal', rows: [] }; }
  private decimal(amount: number): string {
    const digits = minorDigits(this.draft.currency);
    const absolute = Math.abs(amount);
    const scale = 10 ** digits;
    return `${amount < 0 ? '-' : ''}${Math.floor(absolute / scale)}${digits ? '.' + String(absolute % scale).padStart(digits, '0') : ''}`;
  }
  clearValues(): void { this.previewRows.set([]); this.draft.rows.forEach(row => row.value = ''); }
  onGroupChange(): void {
    const requestedGroupId = this.selectedGroupId;
    this.selectedGroupId = this.preferredGroupId;
    this.groupChange.emit(requestedGroupId);
  }
  async loadGroup(): Promise<void> {
    this.draftDirty.set(false);
    this.draftChanged.emit(false);
    const requestId = ++this.groupRequestId;
    this.members.set([]); this.memberNames.set({}); this.customCategories.set([]); this.previewRows.set([]); this.splitEditorOpen.set(!!this.editing); this.previousSplitUsed.set(false); this.message.set(''); this.amountError.set(''); this.descriptionError.set(false); this.draft = this.emptyDraft();
    this.pendingKey = undefined; this.pendingBody = undefined;
    const groupId = this.selectedGroupId;
    const group = this.groups.find(item => item.id === groupId);
    if (!group || !this.service || !this.user) return;
    this.draft.currency = group.currency;
    try {
      await this.loadCategories();
      const [members, names] = await Promise.all([
        this.service.members(groupId),
        this.workerUrl ? loadSharedMemberProfiles(this.workerUrl, groupId, this.user).catch(() => []) : [],
      ]);
      if (this.selectedGroupId !== groupId || requestId !== this.groupRequestId) return;
      this.memberNames.set(Object.fromEntries(names.filter(item => item.displayName).map(item => [item.userId, item.displayName!])));
      const activeMembers = members.filter(member => member.status === 'active');
      this.members.set(activeMembers);
      this.draft.payerId = activeMembers.find(member => member.userId === this.user?.uid)?.userId ?? activeMembers[0]?.userId ?? '';
      this.draft.rows = activeMembers.map(member => ({ userId: member.userId, selected: false, value: '' }));
      this.draft.paymentRows = activeMembers.map(member => ({ userId: member.userId, selected: false, value: '' }));
      const preference = this.editing?.groupId === groupId ? this.editing.entry.splitMode : await this.service.preference(this.user, groupId, new Set(activeMembers.map(member => member.userId)));
      if (this.selectedGroupId === groupId && requestId === this.groupRequestId && !preference) {
        this.draft.rows.forEach(row => { row.selected = true; });
        this.changeDetector.markForCheck();
      }
      if (this.selectedGroupId === groupId && requestId === this.groupRequestId && preference) {
        this.previousSplitUsed.set(!this.editing);
        if (this.editing?.groupId === groupId) {
          const entry = this.editing.entry;
          this.draft.description = entry.description;
          this.draft.amount = this.decimal(entry.amountMinor);
          this.draft.date = entry.date;
          this.draft.categoryId = entry.categoryId;
          this.draft.payerId = entry.payments[0]?.userId ?? '';
          this.draft.multiplePayers = entry.payments.length > 1;
          this.draft.paymentRows.forEach(row => { const payment = entry.payments.find(item => item.userId === row.userId); row.selected = !!payment; row.value = payment ? this.decimal(payment.amountMinor) : ''; });
        }
        this.applyPreference(preference);
        this.changeDetector.markForCheck();
      }
    } catch { if (requestId === this.groupRequestId) this.message.set('membersUnavailable'); }
  }
  memberLabel(userId: string): string {
    if (userId === this.user?.uid) return this.text('me');
    return this.memberNames()[userId] || unnamedExpenseMember(userId, this.members());
  }
  summaryAllocations(): readonly { userId: string; amountMinor: number }[] {
    if (!this.draft.amount) return [];
    try {
      const payerId = this.members().find(member => member.userId === this.user?.uid)?.userId ?? this.members()[0]?.userId ?? '';
      return prepareExpense({ ...this.draft, multiplePayers: false, payerId }, new Set(this.members().map(member => member.userId))).allocations;
    } catch { return []; }
  }
  impact(): { total: number; paid: number; owed: number; net: number } | null {
    if (!this.draft.amount || !this.user?.uid) return null;
    try { return expenseImpact(this.draft, new Set(this.members().map(member => member.userId)), this.user.uid); }
    catch { return null; }
  }
  summaryAmount(userId: string): string {
    const assigned = this.summaryAllocations().find(row => row.userId === userId);
    if (assigned) return formatMinor(assigned.amountMinor, this.draft.currency, locale());
    return this.text('amountPending');
  }
  summaryInput(userId: string): string {
    if (this.draft.kind === 'equal') return '';
    const value = this.draft.rows.find(row => row.userId === userId)?.value;
    return value ? `${value}${this.draft.kind === 'percentage' ? ' %' : this.draft.kind === 'shares' ? ' ×' : ` ${this.draft.currency}`}` : '';
  }
  private applyPreference(mode: SplitMode): void {
    this.draft.kind = mode.kind;
    const values = new Map<string, string>();
    if (mode.kind === 'equal') mode.users.forEach(id => values.set(id, ''));
    else if (mode.kind === 'exact') mode.amounts.forEach(item => values.set(item.userId, this.decimal(item.amountMinor)));
    else if (mode.kind === 'percentage') mode.weightsBasisPoints.forEach(item => values.set(item.userId, String(item.value / 100)));
    else if (mode.kind === 'shares') mode.weights.forEach(item => values.set(item.userId, String(item.value)));
    else mode.adjustments.forEach(item => values.set(item.userId, this.decimal(item.amountMinor)));
    this.draft.rows.forEach(row => { row.selected = values.has(row.userId); row.value = values.get(row.userId) ?? ''; });
  }
  preview(): void {
    this.previewRows.set([]); this.message.set(''); this.paymentError.set(false); this.amountError.set('');
    try {
      const result = prepareExpense(this.draft, new Set(this.members().map(member => member.userId)));
      this.previewRows.set(result.allocations.map(item => ({ userId: item.userId, amountMinor: item.amountMinor })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'splitInvalid';
      this.message.set(message);
      if (message === 'Montant invalide pour cette devise' || message === 'Montant trop élevé' || this.invalidAmount()) {
        this.amountError.set(message === 'Montant ou payeur invalide' ? 'positiveAmount' : message);
        queueMicrotask(() => this.amountInput?.nativeElement.focus());
        return;
      }
      const invalidPayment = this.draft.multiplePayers ? this.invalidPaymentIndex() : -1;
      if (this.draft.multiplePayers && (message === 'Choisissez des payeurs actifs' || message === 'La somme des paiements doit égaler le montant' || invalidPayment >= 0)) {
        this.paymentError.set(true);
        queueMicrotask(() => (this.paymentInputs?.get(Math.max(invalidPayment, 0)) ?? this.payerCheckboxes?.first)?.nativeElement.focus());
      }
    }
  }
  private invalidAmount(): boolean {
    try { return parseMinor(this.draft.amount, this.draft.currency) <= 0; }
    catch { return true; }
  }
  private invalidPaymentIndex(): number {
    return this.draft.paymentRows.filter(row => row.selected).findIndex(row => {
      try { parseMinor(row.value, this.draft.currency); return false; } catch { return true; }
    });
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.selectedGroupId || this.busy()) return;
    this.preview(); if (!this.previewRows().length) return;
    if (!this.draft.description.trim() || this.draft.description.length > 160) {
      this.message.set('descriptionRequired'); this.descriptionError.set(true);
      queueMicrotask(() => this.descriptionInput?.nativeElement.focus());
      return;
    }
    this.busy.set(true);
    try {
      const result = prepareExpense(this.draft, new Set(this.members().map(member => member.userId)));
      const content = { description: this.draft.description.trim(), currency: this.draft.currency, date: this.draft.date, categoryId: this.draft.categoryId, amountMinor: result.amountMinor, payments: result.payments, splitMode: result.splitMode };
      if (this.editing) {
        await this.service.mutate(this.user, this.selectedGroupId, this.editing.entry.id, 'PATCH', { expectedRevision: this.editing.entry.revision, ...content });
      } else {
        const serialized = JSON.stringify(content);
        if (serialized !== this.pendingBody) this.pendingKey = undefined;
        const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
        this.pendingKey = idempotencyKey; this.pendingBody = serialized;
        await this.service.create(this.user, this.selectedGroupId, { idempotencyKey, ...content });
      }
      this.pendingKey = undefined; this.pendingBody = undefined;
      this.message.set(this.editing ? 'updated' : 'saved'); this.draft.description = ''; this.draft.amount = ''; this.previewRows.set([]); this.draftDirty.set(false); this.draftChanged.emit(false); this.saved.emit();
      if (this.editing) this.editCancelled.emit();
    } catch (error) { this.message.set(error instanceof TypeError ? 'saveFailed' : error instanceof Error ? error.message : 'saveFailed'); }
    finally { this.busy.set(false); }
  }
}
