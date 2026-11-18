import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { ExpenseService } from '../../core/firebase/expense-service';
import type { ExpenseHistoryEntry } from '../../core/firebase/expense-service';
import { CategoryService } from '../../core/firebase/category-service';
import { formatMinor, minorDigits } from '../../shared/utils/currency';
import { categories, type CustomCategory } from '../../shared/utils/categories';
import { categoryLabel } from '../../shared/utils/category-label';
import { language, locale } from '../../shared/utils/i18n';
import { parseMinor, prepareExpense, type ExpenseDraft } from './expense-draft';
import type { SplitMode } from '../../shared/utils/split-engine';
import { expenseMessage, expenseText } from './expense-text';

@Component({
  selector: 'app-expense-form', imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="editing ? text('editExpense') : text('newExpense')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-coral" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ editing ? text('editExpense') : text('newExpense') }}</h2>
      @if (editing) { <p class="mt-1 text-sm text-pop-muted">{{ text('authorOnly') }}</p> }
      <p class="mt-2 text-sm leading-6 text-pop-muted">{{ text('splitHelp') }}</p>
      <form class="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" (ngSubmit)="save()">
        <label class="block text-sm font-bold">{{ text('group') }}
          <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="group" [(ngModel)]="selectedGroupId" (ngModelChange)="loadGroup()" [disabled]="!!editing" required>
            <option value="">{{ text('chooseGroup') }}</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        @if (selectedGroupId) {
          <label class="block text-sm font-bold">{{ text('description') }}
            <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="description" [(ngModel)]="draft.description" maxlength="160" required />
          </label>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label class="block text-sm font-bold">{{ text('amount') }}
              <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-lg font-extrabold text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="amount" [(ngModel)]="draft.amount" inputmode="decimal" placeholder="0,00" required />
            </label>
            <div class="block text-sm font-bold">{{ text('fixedCurrency') }}
              <div class="mt-2 min-h-11 rounded-xl border border-pop-border bg-pop-lavender p-3 text-lg font-extrabold text-pop-primary-dark" [attr.aria-label]="text('fixedCurrency')">{{ draft.currency }}</div>
            </div>
          </div>
          <label class="block text-sm font-bold">{{ text('date') }}
            <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" type="date" name="date" [(ngModel)]="draft.date" required />
          </label>
          <label class="block text-sm font-bold">{{ text('category') }}
            <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="category" [(ngModel)]="draft.categoryId">
                @for (category of availableCategories(); track category.id) { <option [value]="category.id">{{ category.icon }} {{ categoryLabel(category.id, language(), category.label) }}</option> }
            </select>
          </label>
          @if (members().length) {
            @if (members().length > 1) { <label class="flex min-h-11 items-center gap-2 text-sm font-bold"><input class="size-5 accent-pop-primary focus-visible:outline-2 focus-visible:outline-pop-primary" type="checkbox" name="multiplePayers" [(ngModel)]="draft.multiplePayers" />{{ text('multiplePayers') }}</label> }
            @if (!draft.multiplePayers) {
              <label class="block text-sm font-bold">{{ text('paidBy') }}
                <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="payer" [(ngModel)]="draft.payerId" required>
                  @for (member of members(); track member.userId) { <option [value]="member.userId">{{ member.userId === user?.uid ? text('me') : member.userId }}</option> }
                </select>
              </label>
            } @else {
              <fieldset class="rounded-2xl border border-pop-border bg-pop-lavender p-4">
                <legend class="px-2 text-sm font-extrabold text-pop-primary-dark">{{ text('paidBy') }}</legend>
                @for (row of draft.paymentRows; track row.userId; let i = $index) {
                  <div class="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-pop-surface px-3 py-2">
                    <label class="flex min-w-0 flex-1 items-center gap-2 text-sm"><input #payerCheckbox class="size-5 shrink-0 accent-pop-primary focus-visible:outline-2 focus-visible:outline-pop-primary" type="checkbox" [name]="'payer-selected-' + i" [(ngModel)]="row.selected" (ngModelChange)="paymentError.set(false); message.set('')" [attr.aria-invalid]="paymentError() ? 'true' : null" [attr.aria-describedby]="paymentError() ? 'payment-error' : null" /><span class="min-w-0 break-all">{{ row.userId === user?.uid ? text('me') : row.userId }}</span></label>
                    @if (row.selected) { <input #paymentInput class="min-h-11 w-24 rounded-xl border border-pop-border p-2 text-right focus-visible:outline-2 focus-visible:outline-pop-primary" [class.border-rose-600]="paymentError()" [name]="'payer-value-' + i" [(ngModel)]="row.value" (ngModelChange)="paymentError.set(false); message.set('')" inputmode="decimal" [attr.aria-label]="text('paymentFor') + ' ' + (row.userId === user?.uid ? text('me') : row.userId)" [attr.aria-invalid]="paymentError() ? 'true' : null" [attr.aria-describedby]="paymentError() ? 'payment-error' : null" [placeholder]="draft.currency" /> }
                  </div>
                }
                @if (paymentError()) { <p id="payment-error" class="mt-3 text-sm font-bold text-rose-700" role="alert">{{ displayMessage(message()) }}</p> }
              </fieldset>
            }
            <fieldset class="rounded-2xl border border-pop-border bg-pop-lavender p-4">
              <legend class="px-2 text-sm font-extrabold text-pop-primary-dark">{{ text('split') }}</legend>
              <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 text-pop-text focus-visible:outline-2 focus-visible:outline-pop-primary" name="mode" [(ngModel)]="draft.kind" (ngModelChange)="clearValues()" [attr.aria-label]="text('splitMethod')">
                <option value="equal">{{ text('equal') }}</option><option value="exact">{{ text('exact') }}</option><option value="percentage">{{ text('percentage') }}</option><option value="shares">{{ text('shares') }}</option><option value="adjustment">{{ text('adjustment') }}</option>
              </select>
              @for (row of draft.rows; track row.userId; let i = $index) {
                <div class="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-pop-surface px-3 py-2">
                  <label class="flex min-w-0 flex-1 items-center gap-2 text-sm"><input class="size-5 shrink-0 accent-pop-primary" type="checkbox" [name]="'selected-' + i" [(ngModel)]="row.selected" /><span class="min-w-0 break-all">{{ row.userId === user?.uid ? text('me') : row.userId }}</span></label>
                  @if (draft.kind !== 'equal' && row.selected) {
                    <input class="min-h-11 w-24 rounded-xl border border-pop-border p-2 text-right focus-visible:outline-2 focus-visible:outline-pop-primary" [name]="'value-' + i" [(ngModel)]="row.value" inputmode="decimal" [attr.aria-label]="text('valueFor') + ' ' + (row.userId === user?.uid ? text('me') : row.userId)" [placeholder]="draft.kind === 'percentage' ? '%' : draft.kind === 'shares' ? text('shares') : draft.currency" />
                  }
                </div>
              }
              <button class="mt-4 min-h-11 rounded-xl border border-pop-primary px-4 py-2 text-sm font-bold text-pop-primary-dark hover:bg-pop-surface focus-visible:outline-2 focus-visible:outline-pop-primary" type="button" (click)="preview()">{{ text('calculate') }}</button>
              @if (previewRows().length) {
                <ul class="mt-3 space-y-1 rounded-xl bg-pop-surface p-3 text-sm" [attr.aria-label]="text('calculated')">
                  @for (row of previewRows(); track row.userId) { <li>{{ row.userId === user?.uid ? text('me') : row.userId }} : {{ formatMinor(row.amountMinor, draft.currency, locale()) }}</li> }
                </ul>
              }
            </fieldset>
            <button class="min-h-11 w-full rounded-xl bg-pop-primary px-5 py-3 font-extrabold text-white shadow-sm hover:bg-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary disabled:opacity-50" type="submit" [disabled]="busy()">{{ editing ? text('saveEdit') : text('save') }}</button>
            @if (editing) { <button class="min-h-11 w-full rounded-xl border border-pop-border px-4 py-3 font-bold text-pop-text" type="button" (click)="editCancelled.emit()">{{ text('cancelEdit') }}</button> }
          } @else { <p class="text-sm text-pop-muted">{{ text('noMembers') }}</p> }
        }
      </form>
      @if (message() && !paymentError()) { <p class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm text-pop-text" [attr.role]="message() === 'saved' || message() === 'updated' ? 'status' : 'alert'">{{ displayMessage(message()) }}</p> }
    </section>
  `,
})
export class ExpenseForm implements OnChanges {
  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  @ViewChildren('paymentInput') private paymentInputs?: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('payerCheckbox') private payerCheckboxes?: QueryList<ElementRef<HTMLInputElement>>;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly editCancelled = new EventEmitter<void>();
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
  readonly customCategories = signal<CustomCategory[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly paymentError = signal(false);
  readonly previewRows = signal<{ userId: string; amountMinor: number }[]>([]);
  selectedGroupId = '';
  draft: ExpenseDraft = this.emptyDraft();
  private service?: ExpenseService;
  private categoryService?: CategoryService;
  private pendingKey?: string;
  private pendingBody?: string;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) {
      this.service = new ExpenseService(this.firebaseApp, this.workerUrl);
      this.categoryService = new CategoryService(this.firebaseApp, this.workerUrl);
    }
    if (!this.editing && !this.selectedGroupId && this.groups.some(group => group.id === this.preferredGroupId)) {
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
  async loadGroup(): Promise<void> {
    this.members.set([]); this.customCategories.set([]); this.previewRows.set([]); this.message.set(''); this.draft = this.emptyDraft();
    this.pendingKey = undefined; this.pendingBody = undefined;
    const groupId = this.selectedGroupId;
    const group = this.groups.find(item => item.id === groupId);
    if (!group || !this.service || !this.user) return;
    this.draft.currency = group.currency;
    try {
      await this.loadCategories();
      const members = (await this.service.members(groupId)).filter(member => member.status === 'active');
      if (this.selectedGroupId !== groupId) return;
      this.members.set(members);
      this.draft.payerId = members.find(member => member.userId === this.user?.uid)?.userId ?? members[0]?.userId ?? '';
      this.draft.rows = members.map(member => ({ userId: member.userId, selected: false, value: '' }));
      this.draft.paymentRows = members.map(member => ({ userId: member.userId, selected: false, value: '' }));
      const preference = this.editing?.groupId === groupId ? this.editing.entry.splitMode : await this.service.preference(this.user, groupId, new Set(members.map(member => member.userId)));
      if (this.selectedGroupId === groupId && preference) {
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
    } catch { this.message.set('membersUnavailable'); }
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
    this.previewRows.set([]); this.message.set(''); this.paymentError.set(false);
    try {
      const result = prepareExpense(this.draft, new Set(this.members().map(member => member.userId)));
      this.previewRows.set(result.allocations.map(item => ({ userId: item.userId, amountMinor: item.amountMinor })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'splitInvalid';
      this.message.set(message);
      const invalidPayment = this.draft.multiplePayers ? this.invalidPaymentIndex() : -1;
      if (this.draft.multiplePayers && (message === 'Choisissez des payeurs actifs' || message === 'La somme des paiements doit égaler le montant' || invalidPayment >= 0)) {
        this.paymentError.set(true);
        queueMicrotask(() => (this.paymentInputs?.get(Math.max(invalidPayment, 0)) ?? this.payerCheckboxes?.first)?.nativeElement.focus());
      }
    }
  }
  private invalidPaymentIndex(): number {
    return this.draft.paymentRows.filter(row => row.selected).findIndex(row => {
      try { parseMinor(row.value, this.draft.currency); return false; } catch { return true; }
    });
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.selectedGroupId || this.busy()) return;
    this.preview(); if (!this.previewRows().length) return;
    if (!this.draft.description.trim() || this.draft.description.length > 160) { this.message.set('descriptionRequired'); return; }
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
      this.message.set(this.editing ? 'updated' : 'saved'); this.draft.description = ''; this.draft.amount = ''; this.previewRows.set([]); this.saved.emit();
      if (this.editing) this.editCancelled.emit();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'saveFailed'); }
    finally { this.busy.set(false); }
  }
}
