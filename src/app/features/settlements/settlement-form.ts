import { ChangeDetectorRef, Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ExpenseService } from '../../core/firebase/expense-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { SettlementService, type SettlementRequest } from '../../core/firebase/settlement-service';
import { parseMinor } from '../expenses/expense-draft';

@Component({
  selector: 'app-settlement-form',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Déclarer un remboursement">
      <h2 class="text-lg font-semibold">Déclarer un remboursement</h2>
      <p class="mt-1 text-sm text-slate-600">Enregistre un remboursement que vous avez envoyé. Aucun argent n’est transféré.</p>
      <form class="mt-5 space-y-4" (ngSubmit)="save()">
        <label class="block text-sm font-medium">Groupe
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="settlementGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="loadMembers()" required>
            <option value="">Choisir un groupe</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        @if (selectedGroupId) {
          <label class="block text-sm font-medium">Remboursé à
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="settlementRecipient" [(ngModel)]="recipientId" required>
              <option value="">Choisir un membre</option>
              @for (member of recipients(); track member.userId) { <option [value]="member.userId">{{ member.userId }}</option> }
            </select>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium">Montant
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="settlementAmount" [(ngModel)]="amount" inputmode="decimal" placeholder="0,00" required />
            </label>
            <label class="block text-sm font-medium">Devise
              <input class="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-3" [value]="currency" readonly />
            </label>
          </div>
          <label class="block text-sm font-medium">Date
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="date" name="settlementDate" [(ngModel)]="date" required />
          </label>
          <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" [disabled]="busy() || !recipientId">Enregistrer le remboursement</button>
        }
      </form>
      @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class SettlementForm implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  readonly recipients = signal<GroupMember[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  recipientId = '';
  amount = '';
  currency = 'CAD';
  date = new Date().toISOString().slice(0, 10);
  private expenseService?: ExpenseService;
  private settlementService?: SettlementService;
  private pendingKey?: string;
  private pendingBody?: string;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  ngOnChanges(): void {
    if (this.firebaseApp && this.workerUrl) {
      this.expenseService = new ExpenseService(this.firebaseApp, this.workerUrl);
      this.settlementService = new SettlementService(this.workerUrl);
    }
  }

  async loadMembers(): Promise<void> {
    const groupId = this.selectedGroupId;
    this.recipients.set([]); this.recipientId = ''; this.message.set('');
    this.pendingKey = undefined; this.pendingBody = undefined;
    const group = this.groups.find(item => item.id === groupId);
    if (!group || !this.expenseService || !this.user) return;
    this.currency = group.currency;
    try {
      const members = await this.expenseService.members(groupId);
      if (this.selectedGroupId !== groupId) return;
      this.recipients.set(members.filter(member => member.status === 'active' && member.userId !== this.user?.uid));
      this.changeDetector.markForCheck();
    } catch { this.message.set('Membres indisponibles.'); }
  }

  async save(): Promise<void> {
    if (!this.settlementService || !this.user || !this.selectedGroupId || this.busy()) return;
    if (!this.recipients().some(member => member.userId === this.recipientId)) { this.message.set('Choisissez un membre actif.'); return; }
    let amountMinor: number;
    try { amountMinor = parseMinor(this.amount, this.currency); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Montant invalide'); return; }
    if (amountMinor <= 0) { this.message.set('Montant positif requis.'); return; }
    const content = { date: this.date, currency: this.currency, amountMinor, fromUserId: this.user.uid, toUserId: this.recipientId };
    const serialized = JSON.stringify(content);
    if (serialized !== this.pendingBody) this.pendingKey = undefined;
    const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
    this.pendingKey = idempotencyKey; this.pendingBody = serialized;
    this.busy.set(true); this.message.set('');
    try {
      await this.settlementService.create(this.user, this.selectedGroupId, { idempotencyKey, ...content } satisfies SettlementRequest);
      this.pendingKey = undefined; this.pendingBody = undefined;
      this.amount = ''; this.message.set('Remboursement enregistré.');
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible'); }
    finally { this.busy.set(false); }
  }
}
