import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ExpenseService } from '../../core/firebase/expense-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { SettlementService, type SettlementRequest } from '../../core/firebase/settlement-service';
import { t } from '../../shared/utils/i18n';
import { parseMinor } from '../expenses/expense-draft';
import { settlementMessage, settlementText } from './settlement-text';

@Component({
  selector: 'app-settlement-form',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="text('title')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ text('title') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ text('intro') }}</p>
      <form class="mt-5 space-y-4" (ngSubmit)="save()">
        <label class="block text-sm font-bold">{{ t('group') }}
          <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="settlementGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="loadMembers()" required>
            <option value="">{{ t('chooseGroup') }}</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        @if (selectedGroupId) {
          <label class="block text-sm font-bold">{{ text('recipient') }}
            <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="settlementRecipient" [(ngModel)]="recipientId" required>
              <option value="">{{ text('chooseMember') }}</option>
              @for (member of recipients(); track member.userId) { <option [value]="member.userId">{{ memberLabel(member.userId) }}</option> }
            </select>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-bold">{{ text('amount') }}
              <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="settlementAmount" [(ngModel)]="amount" inputmode="decimal" placeholder="0,00" required />
            </label>
            <label class="block text-sm font-bold">{{ text('currency') }}
              <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-lavender p-3 font-bold text-pop-primary-dark" [value]="currency" readonly />
            </label>
          </div>
          <label class="block text-sm font-bold">{{ text('date') }}
            <input class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" type="date" name="settlementDate" [(ngModel)]="date" required />
          </label>
          <button class="min-h-11 w-full rounded-xl bg-pop-primary px-4 py-3 font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="submit" [disabled]="busy() || !recipientId">{{ text('save') }}</button>
        }
      </form>
      @if (message()) { <p class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm" role="status">{{ displayMessage(message()) }}</p> }
    </section>
  `,
})
export class SettlementForm implements OnChanges {
  @Output() readonly saved = new EventEmitter<void>();
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  readonly recipients = signal<GroupMember[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly text = settlementText;
  readonly t = t;
  readonly displayMessage = settlementMessage;
  memberLabel(userId: string): string { return `${t('otherMember')} ${userId.slice(0, 8)}`; }
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
      this.settlementService = new SettlementService(this.firebaseApp, this.workerUrl);
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
      this.amount = ''; this.message.set('Remboursement enregistré.'); this.saved.emit();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible'); }
    finally { this.busy.set(false); }
  }
}
