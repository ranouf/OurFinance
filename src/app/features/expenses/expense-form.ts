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
import type { SplitMode } from '../../shared/utils/split-engine';
import { expenseMessage, expenseText, unnamedExpenseMember } from './expense-text';

@Component({
  selector: 'app-expense-form', imports: [FieldComponent, ControlErrorsComponent, DropdownComponent, UiCheckboxDirective, UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="editing ? text('editExpense') : text('newExpense')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-coral" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ editing ? text('editExpense') : text('newExpense') }}</h2>
      @if (editing) { <p class="mt-1 text-sm text-pop-muted">{{ text('authorOnly') }}</p> }
      <p class="mt-2 text-sm leading-6 text-pop-muted">{{ text('splitHelp') }}</p>
      <form class="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" (input)="markDraft()" (ngSubmit)="save()">
        <app-field class="block" controlId="group" [label]="text('group')"><app-dropdown controlId="group" [options]="groupDropdownOptions(groups, text('chooseGroup'), false)" name="group" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()" [disabled]="!!editing || draftDirty()" required /></app-field>
        @if (draftDirty() && !editing) { <div class="flex flex-wrap items-center gap-2 text-sm"><span>{{ text('draftGroupLocked') }}</span><app-ui-button variant="ghost" type="button" (click)="discardDraft()">{{ text('discardDraft') }}</app-ui-button></div> }
        @if (selectedGroupId) {
          <label class="block text-sm font-bold">{{ text('description') }}
            <input #descriptionInput appUiControl class="mt-2 w-full" name="description" [(ngModel)]="draft.description" (ngModelChange)="descriptionError.set(false)" [attr.aria-invalid]="descriptionError() ? 'true' : null" [attr.aria-describedby]="descriptionError() ? 'expense-description-error' : null" aria-required="true" maxlength="160" />
            @if (descriptionError()) { <app-control-errors errorId="expense-description-error" [explicitMessage]="text('descriptionRequired')" /> }
          </label>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label class="block text-sm font-bold">{{ text('amount') }}
              <input #amountInput appUiControl class="mt-2 w-full" name="amount" [(ngModel)]="draft.amount" (ngModelChange)="previewRows.set([]); amountError.set('')" [attr.aria-invalid]="amountError() ? 'true' : null" [attr.aria-describedby]="amountError() ? 'expense-amount-error' : null" aria-required="true" inputmode="decimal" placeholder="0,00" />
              @if (amountError()) { <app-control-errors errorId="expense-amount-error" [explicitMessage]="displayMessage(amountError())" /> }
            </label>
            <div class="block text-sm font-bold">{{ text('fixedCurrency') }}
              <div class="mt-2 min-h-11 rounded-xl border border-pop-border bg-pop-lavender p-3 text-lg font-extrabold text-pop-primary-dark" [attr.aria-label]="text('fixedCurrency')">{{ draft.currency }}</div>
            </div>
          </div>
          <label class="block text-sm font-bold">{{ text('date') }}
            <input appUiControl class="mt-2 w-full" type="date" name="date" [(ngModel)]="draft.date" required />
          </label>
          <app-field class="block" controlId="expense-category" [label]="text('category')">
            <app-dropdown controlId="expense-category" name="category" [options]="expenseCategoryOptions()" [(ngModel)]="draft.categoryId" (ngModelChange)="markDraft()" />
          </app-field>
          @if (members().length) {
            @if (members().length > 1) { <label class="flex min-h-11 items-center gap-2 text-sm font-bold"><input appUiCheckbox class="size-5 accent-pop-primary focus-visible:outline-2 focus-visible:outline-pop-primary" type="checkbox" name="multiplePayers" [(ngModel)]="draft.multiplePayers" (ngModelChange)="markDraft()" />{{ text('multiplePayers') }}</label> }
            @if (!draft.multiplePayers) {
              <app-field class="block" controlId="expense-payer" [label]="text('paidBy')" [required]="true">
                <app-dropdown controlId="expense-payer" name="payer" [options]="payerOptions()" [(ngModel)]="draft.payerId" (ngModelChange)="markDraft()" required />
              </app-field>
            } @else {
              <fieldset class="rounded-2xl border border-pop-border bg-pop-lavender p-4">
                <legend class="px-2 text-sm font-extrabold text-pop-primary-dark">{{ text('paidBy') }}</legend>
                @for (row of draft.paymentRows; track row.userId; let i = $index) {
                  <div class="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-pop-surface px-3 py-2">
                    <label class="flex min-w-0 flex-1 items-center gap-2 text-sm"><input appUiCheckbox #payerCheckbox class="size-5 shrink-0 accent-pop-primary focus-visible:outline-2 focus-visible:outline-pop-primary" type="checkbox" [name]="'payer-selected-' + i" [(ngModel)]="row.selected" (ngModelChange)="paymentError.set(false); message.set(''); markDraft()" [attr.aria-invalid]="paymentError() ? 'true' : null" [attr.aria-describedby]="paymentError() ? 'payment-error' : null" /><span class="min-w-0 break-all">{{ memberLabel(row.userId) }}</span></label>
                    @if (row.selected) { <input appUiControl #paymentInput class="min-w-0 max-w-24 flex-none" [class.border-rose-600]="paymentError()" [name]="'payer-value-' + i" [(ngModel)]="row.value" (ngModelChange)="paymentError.set(false); message.set('')" inputmode="decimal" [attr.aria-label]="text('paymentFor') + ' ' + (memberLabel(row.userId))" [attr.aria-invalid]="paymentError() ? 'true' : null" [attr.aria-describedby]="paymentError() ? 'payment-error' : null" [placeholder]="draft.currency" /> }
                  </div>
                }
                @if (paymentError()) { <app-ui-alert variant="error" class="mt-3" id="payment-error">{{ displayMessage(message()) }}</app-ui-alert> }
              </fieldset>
            }
            <fieldset class="rounded-2xl border border-pop-border bg-pop-lavender p-4">
              <legend class="px-2 text-sm font-extrabold text-pop-primary-dark">{{ text('split') }}</legend>
              <app-field controlId="expense-split-mode" [label]="text('splitMethod')">
                <app-dropdown controlId="expense-split-mode" name="mode" [options]="splitModeOptions()" [(ngModel)]="draft.kind" (ngModelChange)="clearValues(); markDraft()" />
              </app-field>
              @for (row of draft.rows; track row.userId; let i = $index) {
                <div class="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-pop-surface px-3 py-2">
                  <label class="flex min-w-0 flex-1 items-center gap-2 text-sm"><input appUiCheckbox class="size-5 shrink-0 accent-pop-primary" type="checkbox" [name]="'selected-' + i" [(ngModel)]="row.selected" (ngModelChange)="previewRows.set([]); markDraft()" /><span class="min-w-0 break-all">{{ memberLabel(row.userId) }}</span></label>
                  @if (draft.kind !== 'equal' && row.selected) {
                    <input appUiControl class="min-w-0 max-w-24 flex-none" [name]="'value-' + i" [(ngModel)]="row.value" (ngModelChange)="previewRows.set([])" inputmode="decimal" [attr.aria-label]="text('valueFor') + ' ' + (memberLabel(row.userId))" [placeholder]="draft.kind === 'percentage' ? '%' : draft.kind === 'shares' ? text('shares') : draft.currency" />
                  }
                </div>
              }
              <app-ui-button variant="outline" class="mt-4" type="button" (click)="preview()">{{ text('calculate') }}</app-ui-button>
              @if (previewRows().length) {
                <ul class="mt-3 space-y-1 rounded-xl bg-pop-surface p-3 text-sm" [attr.aria-label]="text('calculated')">
                  @for (row of previewRows(); track row.userId) { <li>{{ memberLabel(row.userId) }} : {{ formatMinor(row.amountMinor, draft.currency, locale()) }}</li> }
                </ul>
              }
            </fieldset>
            <app-ui-button variant="primary" [block]="true" class="w-full" type="submit" [disabled]="busy()">{{ editing ? text('saveEdit') : text('save') }}</app-ui-button>
            @if (editing) { <app-ui-button variant="secondary" [block]="true" class="w-full" type="button" (click)="editCancelled.emit()">{{ text('cancelEdit') }}</app-ui-button> }
          } @else { <p class="text-sm text-pop-muted">{{ text('noMembers') }}</p> }
        }
      </form>
      @if (message() && !paymentError() && !amountError() && !descriptionError()) { <app-ui-alert class="mt-4" [variant]="message() === 'saved' || message() === 'updated' ? 'success' : 'error'">{{ displayMessage(message()) }}</app-ui-alert> }
    </section>
  `,
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
  onGroupChange(): void { this.groupChange.emit(this.selectedGroupId); void this.loadGroup(); }
  async loadGroup(): Promise<void> {
    this.draftDirty.set(false);
    this.draftChanged.emit(false);
    const requestId = ++this.groupRequestId;
    this.members.set([]); this.memberNames.set({}); this.customCategories.set([]); this.previewRows.set([]); this.message.set(''); this.amountError.set(''); this.descriptionError.set(false); this.draft = this.emptyDraft();
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
      if (this.selectedGroupId === groupId && requestId === this.groupRequestId && preference) {
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
