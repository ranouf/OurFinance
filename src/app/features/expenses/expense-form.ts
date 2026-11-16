import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { ExpenseService } from '../../core/firebase/expense-service';
import { CategoryService } from '../../core/firebase/category-service';
import { formatMinor, minorDigits } from '../../shared/utils/currency';
import { categories, type CustomCategory } from '../../shared/utils/categories';
import { categoryLabel } from '../../shared/utils/category-label';
import { language, locale } from '../../shared/utils/i18n';
import { prepareExpense, type ExpenseDraft } from './expense-draft';
import type { SplitMode } from '../../shared/utils/split-engine';

@Component({
  selector: 'app-expense-form', imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Nouvelle dépense">
      <h2 class="text-lg font-semibold">Nouvelle dépense</h2>
      <p class="mt-1 text-sm text-slate-600">Choisissez une répartition pour cette dépense. La préférence du groupe est proposée seulement après une dépense enregistrée.</p>
      <form class="mt-5 space-y-4" (ngSubmit)="save()">
        <label class="block text-sm font-medium">Groupe
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="group" [(ngModel)]="selectedGroupId" (ngModelChange)="loadGroup()" required>
            <option value="">Choisir un groupe</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        @if (selectedGroupId) {
          <label class="block text-sm font-medium">Description
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="description" [(ngModel)]="draft.description" maxlength="160" required />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium">Montant
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="amount" [(ngModel)]="draft.amount" inputmode="decimal" placeholder="0,00" required />
            </label>
            <div class="block text-sm font-medium">Devise du groupe
              <div class="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-3" aria-label="Devise fixe du groupe">{{ draft.currency }}</div>
            </div>
          </div>
          <label class="block text-sm font-medium">Date
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="date" [(ngModel)]="draft.date" required />
          </label>
          <label class="block text-sm font-medium">Catégorie
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="category" [(ngModel)]="draft.categoryId">
                @for (category of availableCategories(); track category.id) { <option [value]="category.id">{{ category.icon }} {{ categoryLabel(category.id, language(), category.label) }}</option> }
            </select>
          </label>
          @if (members().length) {
            <label class="block text-sm font-medium">Payé par
              <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="payer" [(ngModel)]="draft.payerId" required>
                @for (member of members(); track member.userId) { <option [value]="member.userId">{{ member.userId === user?.uid ? 'Moi' : member.userId }}</option> }
              </select>
            </label>
            <fieldset class="rounded-xl border border-slate-200 p-3">
              <legend class="px-1 text-sm font-medium">Répartition</legend>
              <select class="mt-2 w-full rounded-lg border border-slate-300 p-3" name="mode" [(ngModel)]="draft.kind" (ngModelChange)="clearValues()" aria-label="Méthode de répartition">
                <option value="equal">Égalitaire</option><option value="exact">Montants exacts</option><option value="percentage">Pourcentages</option><option value="shares">Parts</option><option value="adjustment">Ajustements</option>
              </select>
              @for (row of draft.rows; track row.userId; let i = $index) {
                <div class="mt-3 flex items-center gap-3">
                  <label class="flex min-w-0 flex-1 items-center gap-2 text-sm"><input class="shrink-0" type="checkbox" [name]="'selected-' + i" [(ngModel)]="row.selected" /><span class="min-w-0 break-all">{{ row.userId === user?.uid ? 'Moi' : row.userId }}</span></label>
                  @if (draft.kind !== 'equal' && row.selected) {
                    <input class="w-24 rounded-lg border border-slate-300 p-2 text-right" [name]="'value-' + i" [(ngModel)]="row.value" inputmode="decimal" [attr.aria-label]="'Valeur pour ' + row.userId" [placeholder]="draft.kind === 'percentage' ? '%' : draft.kind === 'shares' ? 'parts' : draft.currency" />
                  }
                </div>
              }
              <button class="mt-4 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800" type="button" (click)="preview()">Calculer les parts</button>
              @if (previewRows().length) {
                <ul class="mt-3 text-sm" aria-label="Parts calculées">
                  @for (row of previewRows(); track row.userId) { <li>{{ row.userId === user?.uid ? 'Moi' : row.userId }} : {{ formatMinor(row.amountMinor, draft.currency, locale()) }}</li> }
                </ul>
              }
            </fieldset>
            <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" [disabled]="busy()">Enregistrer la dépense</button>
          } @else { <p class="text-sm text-slate-600">Aucun membre actif disponible.</p> }
        }
      </form>
      @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ExpenseForm implements OnChanges {
  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  @Output() readonly saved = new EventEmitter<void>();
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input() categoryRevision = 0;
  readonly categories = categories;
  readonly categoryLabel = categoryLabel;
  readonly language = language;
  readonly locale = locale;
  readonly formatMinor = formatMinor;
  readonly members = signal<{ userId: string }[]>([]);
  readonly customCategories = signal<CustomCategory[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
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
    if (changes['categoryRevision'] && !changes['categoryRevision'].firstChange && this.selectedGroupId) void this.loadCategories().catch(() => this.message.set('Catégories indisponibles.'));
  }
  availableCategories() { return [...categories, ...this.customCategories().filter(category => category.status === 'active')]; }
  private async loadCategories(): Promise<void> {
    const groupId = this.selectedGroupId;
    if (!groupId || !this.categoryService) return;
    const items = await this.categoryService.list(groupId);
    if (this.selectedGroupId !== groupId) return;
    this.customCategories.set(items);
    if (!this.availableCategories().some(category => category.id === this.draft.categoryId)) this.draft.categoryId = 'other';
  }
  private emptyDraft(): ExpenseDraft { return { description: '', amount: '', currency: 'CAD', date: new Date().toISOString().slice(0, 10), categoryId: 'other', payerId: '', kind: 'equal', rows: [] }; }
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
      const preference = await this.service.preference(this.user, groupId, new Set(members.map(member => member.userId)));
      if (this.selectedGroupId === groupId && preference) {
        this.applyPreference(preference);
        this.changeDetector.markForCheck();
      }
    } catch { this.message.set('Membres ou préférence indisponibles.'); }
  }
  private applyPreference(mode: SplitMode): void {
    this.draft.kind = mode.kind;
    const values = new Map<string, string>();
    const digits = minorDigits(this.draft.currency);
    const decimal = (amount: number) => {
      const absolute = Math.abs(amount);
      const scale = 10 ** digits;
      return `${amount < 0 ? '-' : ''}${Math.floor(absolute / scale)}${digits ? '.' + String(absolute % scale).padStart(digits, '0') : ''}`;
    };
    if (mode.kind === 'equal') mode.users.forEach(id => values.set(id, ''));
    else if (mode.kind === 'exact') mode.amounts.forEach(item => values.set(item.userId, decimal(item.amountMinor)));
    else if (mode.kind === 'percentage') mode.weightsBasisPoints.forEach(item => values.set(item.userId, String(item.value / 100)));
    else if (mode.kind === 'shares') mode.weights.forEach(item => values.set(item.userId, String(item.value)));
    else mode.adjustments.forEach(item => values.set(item.userId, decimal(item.amountMinor)));
    this.draft.rows.forEach(row => { row.selected = values.has(row.userId); row.value = values.get(row.userId) ?? ''; });
  }
  preview(): void {
    this.previewRows.set([]); this.message.set('');
    try {
      const result = prepareExpense(this.draft, new Set(this.members().map(member => member.userId)));
      this.previewRows.set(result.allocations.map(item => ({ userId: item.userId, amountMinor: item.amountMinor })));
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Répartition invalide'); }
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.selectedGroupId || this.busy()) return;
    this.preview(); if (!this.previewRows().length) return;
    if (!this.draft.description.trim() || this.draft.description.length > 160) { this.message.set('Description requise'); return; }
    this.busy.set(true);
    try {
      const result = prepareExpense(this.draft, new Set(this.members().map(member => member.userId)));
      const content = { description: this.draft.description.trim(), currency: this.draft.currency, date: this.draft.date, categoryId: this.draft.categoryId, amountMinor: result.amountMinor, payments: result.payments, splitMode: result.splitMode };
      const serialized = JSON.stringify(content);
      if (serialized !== this.pendingBody) this.pendingKey = undefined;
      const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
      this.pendingKey = idempotencyKey; this.pendingBody = serialized;
      await this.service.create(this.user, this.selectedGroupId, { idempotencyKey, ...content });
      this.pendingKey = undefined; this.pendingBody = undefined;
      this.message.set('Dépense enregistrée.'); this.draft.description = ''; this.draft.amount = ''; this.previewRows.set([]); this.saved.emit();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible'); }
    finally { this.busy.set(false); }
  }
}
