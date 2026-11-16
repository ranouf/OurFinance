import { ChangeDetectorRef, Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { ExpenseService } from '../../core/firebase/expense-service';
import { FxSettlementService, type FxSettlementEntry, type FxSettlementRequest } from '../../core/firebase/fx-settlement-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { currencyCodes, formatMinor } from '../../shared/utils/currency';
import { convertMinor, type ExchangeRateSnapshot } from '../../shared/utils/exchange-rate';
import { parseMinor } from '../expenses/expense-draft';

@Component({
  selector: 'app-fx-settlement-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Remboursements multidevises">
      <h2 class="text-lg font-semibold">Remboursement dans une autre devise</h2>
      <p class="mt-1 text-sm text-slate-600">Déclare un transfert déjà effectué ; aucun argent n’est envoyé par l’application. Le taux est saisi manuellement et conservé avec sa date.</p>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxGroup" [(ngModel)]="groupId" (ngModelChange)="selectGroup()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (groupId) {
        <form class="mt-4 space-y-4" (ngSubmit)="save()">
          <label class="block text-sm font-medium">Remboursé à
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxRecipient" [(ngModel)]="recipientId" required>
              <option value="">Choisir un membre</option>
              @for (member of recipients(); track member.userId) { <option [value]="member.userId">{{ member.userId }}</option> }
            </select>
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="block text-sm font-medium">Dette réglée
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxDebtAmount" [(ngModel)]="debtAmount" inputmode="decimal" placeholder="0,00" required />
            </label>
            <label class="block text-sm font-medium">Devise de la dette
              <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxDebtCurrency" [(ngModel)]="debtCurrency">
                @for (code of currencies; track code) { <option [value]="code">{{ code }}</option> }
              </select>
            </label>
            <label class="block text-sm font-medium">Montant transféré
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxPaymentAmount" [(ngModel)]="paymentAmount" inputmode="decimal" placeholder="0" required />
            </label>
            <label class="block text-sm font-medium">Devise du transfert
              <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxPaymentCurrency" [(ngModel)]="paymentCurrency">
                @for (code of currencies; track code) { <option [value]="code">{{ code }}</option> }
              </select>
            </label>
          </div>
          <label class="block text-sm font-medium">Taux : 1 {{ debtCurrency }} vaut combien de {{ paymentCurrency }} ?
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="fxRate" [(ngModel)]="rate" inputmode="decimal" placeholder="1,25" required />
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="block text-sm font-medium">Date du taux
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="fxRateDate" [(ngModel)]="rateDate" required />
            </label>
            <label class="block text-sm font-medium">Date du remboursement
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="fxDate" [(ngModel)]="date" required />
            </label>
          </div>
          <p class="text-sm text-slate-600" role="status">{{ preview() }}</p>
          <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" [disabled]="busy() || !recipientId">Enregistrer le transfert</button>
        </form>
        <div class="mt-6 border-t border-slate-200 pt-4">
          <h3 class="font-semibold">Historique multidevise</h3>
          <button class="mt-2 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="historyBusy()" (click)="refresh()">Actualiser</button>
          @if (entries().length) {
            <ul class="mt-3 divide-y divide-slate-200">
              @for (entry of entries(); track entry.id) {
                <li class="py-3 text-sm"><p class="break-all font-medium">{{ memberLabel(entry.fromUserId) }} → {{ memberLabel(entry.toUserId) }}</p>
                  <p>{{ amount(entry.debtAmountMinor, entry.debtCurrency) }} de dette réglée par {{ amount(entry.paymentAmountMinor, entry.paymentCurrency) }}</p>
                  <p class="text-slate-600">{{ entry.date }} · taux du {{ entry.rateDate }} : 1 {{ entry.debtCurrency }} = {{ entry.rate }} {{ entry.paymentCurrency }}</p>
                </li>
              }
            </ul>
            @if (hasMore()) { <button class="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="historyBusy()" (click)="loadMore()">Afficher plus</button> }
          } @else if (!historyBusy()) { <p class="mt-3 text-sm text-slate-600">Aucun transfert multidevise dans ce groupe.</p> }
        </div>
      }
      @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class FxSettlementPanel implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  readonly currencies = currencyCodes();
  readonly recipients = signal<GroupMember[]>([]);
  readonly entries = signal<FxSettlementEntry[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly historyBusy = signal(false);
  readonly message = signal('');
  groupId = ''; recipientId = ''; debtAmount = ''; paymentAmount = ''; debtCurrency = 'CAD'; paymentCurrency = 'JPY'; rate = '';
  date = new Date().toISOString().slice(0, 10); rateDate = this.date;
  private expenses?: ExpenseService;
  private service?: FxSettlementService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;
  private pendingBody?: string;
  private pendingKey?: string;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  ngOnChanges(): void {
    if (this.firebaseApp && this.workerUrl) {
      this.expenses = new ExpenseService(this.firebaseApp, this.workerUrl);
      this.service = new FxSettlementService(this.firebaseApp, this.workerUrl);
    }
  }
  amount(value: number, code: string): string { return formatMinor(value, code, 'fr-CA'); }
  memberLabel(uid: string): string { return uid === this.user?.uid ? 'Moi' : uid; }
  preview(): string {
    try {
      const debt = parseMinor(this.debtAmount, this.debtCurrency);
      const expected = convertMinor(debt, this.snapshot());
      return `Selon le taux, ${this.amount(debt, this.debtCurrency)} correspond à ${this.amount(expected, this.paymentCurrency)}.`;
    } catch { return 'Saisissez les montants et le taux pour vérifier la conversion.'; }
  }
  private snapshot(): ExchangeRateSnapshot {
    return { sourceCurrency: this.debtCurrency, targetCurrency: this.paymentCurrency, rate: this.rate.replace(',', '.'), date: this.rateDate, origin: 'manual' };
  }
  async selectGroup(): Promise<void> {
    const groupId = this.groupId;
    this.requestId++; this.historyBusy.set(false); this.recipients.set([]); this.entries.set([]); this.hasMore.set(false); this.last = undefined;
    this.recipientId = ''; this.message.set(''); this.pendingKey = undefined; this.pendingBody = undefined;
    this.debtCurrency = this.groups.find(group => group.id === groupId)?.currency ?? 'CAD';
    if (!groupId || !this.user || !this.expenses) return;
    try {
      const members = await this.expenses.members(groupId);
      if (this.groupId !== groupId) return;
      this.recipients.set(members.filter(member => member.status === 'active' && member.userId !== this.user?.uid));
      this.changeDetector.markForCheck();
      await this.refresh();
    } catch { if (this.groupId === groupId) this.message.set('Membres ou historique indisponibles.'); }
  }
  async refresh(): Promise<void> { this.entries.set([]); this.last = undefined; this.hasMore.set(false); await this.loadMore(); }
  async loadMore(): Promise<void> {
    if (this.historyBusy()) return;
    const groupId = this.groupId, requestId = ++this.requestId;
    if (!groupId || !this.service) return;
    this.historyBusy.set(true);
    try {
      const page = await this.service.history(groupId, this.last);
      if (requestId !== this.requestId || groupId !== this.groupId) return;
      this.entries.update(values => [...values, ...page.entries]); this.last = page.last; this.hasMore.set(page.hasMore);
      this.changeDetector.markForCheck();
    } catch { if (requestId === this.requestId) this.message.set('Historique indisponible.'); }
    finally { if (requestId === this.requestId) this.historyBusy.set(false); }
  }
  async save(): Promise<void> {
    if (!this.user || !this.service || !this.groupId || this.busy()) return;
    if (!this.recipients().some(member => member.userId === this.recipientId)) { this.message.set('Choisissez un membre actif.'); return; }
    let debtAmountMinor: number, paymentAmountMinor: number, snapshot: ExchangeRateSnapshot;
    try {
      debtAmountMinor = parseMinor(this.debtAmount, this.debtCurrency);
      paymentAmountMinor = parseMinor(this.paymentAmount, this.paymentCurrency);
      snapshot = this.snapshot();
      if (debtAmountMinor <= 0 || paymentAmountMinor <= 0 || convertMinor(debtAmountMinor, snapshot) !== paymentAmountMinor) throw new Error('Montant transféré différent de la conversion arrondie.');
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Conversion invalide.'); return; }
    const content = { date: this.date, debtCurrency: this.debtCurrency, debtAmountMinor, paymentCurrency: this.paymentCurrency,
      paymentAmountMinor, rate: snapshot.rate, rateDate: snapshot.date, fromUserId: this.user.uid, toUserId: this.recipientId };
    const serialized = JSON.stringify(content);
    if (serialized !== this.pendingBody) this.pendingKey = undefined;
    const idempotencyKey = this.pendingKey ?? crypto.randomUUID(); this.pendingKey = idempotencyKey; this.pendingBody = serialized;
    this.busy.set(true); this.message.set('');
    try {
      await this.service.create(this.user, this.groupId, { idempotencyKey, ...content } satisfies FxSettlementRequest);
      this.pendingKey = undefined; this.pendingBody = undefined; this.debtAmount = ''; this.paymentAmount = '';
      this.message.set('Remboursement multidevise enregistré.');
      await this.refresh();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
}
