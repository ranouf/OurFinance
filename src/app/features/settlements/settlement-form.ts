import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, signal, ViewChild } from '@angular/core';
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
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="text('title')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ text('title') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ text('intro') }}</p>
      <form class="mt-5 space-y-4" (ngSubmit)="save()">
        <app-field class="block" controlId="settlementGroup" [label]="t('group')"><app-dropdown controlId="settlementGroup" [options]="groupDropdownOptions(groups, t('chooseGroup'), false)" name="settlementGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="onGroupChange()" required /></app-field>
        @if (selectedGroupId) {
          <app-field class="block" controlId="settlement-recipient" [label]="text('recipient')">
            <app-dropdown controlId="settlement-recipient" name="settlementRecipient" [options]="recipientOptions()" [(ngModel)]="recipientId" required />
          </app-field>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-bold">{{ text('amount') }}
              <input #amountInput appUiControl class="mt-2 w-full" name="settlementAmount" [(ngModel)]="amount" (ngModelChange)="clearAmountError()" inputmode="decimal" placeholder="0,00" [attr.aria-invalid]="amountError() ? 'true' : null" [attr.aria-describedby]="amountError() ? 'settlement-amount-error' : null" required />
              @if (amountError()) { <span id="settlement-amount-error" role="alert" class="mt-1 block text-sm text-rose-700">{{ displayMessage(message()) }}</span> }
            </label>
            <label class="block text-sm font-bold">{{ text('currency') }}
              <input appUiControl class="mt-2 w-full bg-pop-lavender" [value]="currency" readonly />
            </label>
          </div>
          <label class="block text-sm font-bold">{{ text('date') }}
            <input appUiControl class="mt-2 w-full" type="date" name="settlementDate" [(ngModel)]="date" required />
          </label>
          <app-ui-button variant="primary" [block]="true" class="w-full" type="submit" [disabled]="busy() || !recipientId">{{ text('save') }}</app-ui-button>
        }
      </form>
      @if (message() && !amountError()) { <app-ui-alert [variant]="messageVariant()" class="mt-4">{{ displayMessage(message()) }}</app-ui-alert> }
    </section>
  `,
})
export class SettlementForm implements OnChanges {
  @ViewChild('amountInput') private amountInput?: ElementRef<HTMLInputElement>;
  readonly groupDropdownOptions = groupDropdownOptions;
  recipientOptions(): DropdownOption[] { return [{ value: '', label: this.text('chooseMember') }, ...this.recipients().map(member => ({ value: member.userId, label: this.memberLabel(member.userId) }))]; }
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly groupChange = new EventEmitter<string>();
  @Input({ required: true }) groups: Group[] = [];
  @Input() preferredGroupId = '';
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  readonly recipients = signal<GroupMember[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly amountError = signal(false);
  readonly messageVariant = signal<'error' | 'success'>('error');
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
    if (this.selectedGroupId !== this.preferredGroupId && (!this.preferredGroupId || this.groups.some(group => group.id === this.preferredGroupId))) {
      this.selectedGroupId = this.preferredGroupId;
      void this.loadMembers();
    }
  }

  onGroupChange(): void { this.groupChange.emit(this.selectedGroupId); void this.loadMembers(); }
  clearAmountError(): void { if (this.amountError()) { this.amountError.set(false); this.message.set(''); } }
  private rejectAmount(message: string): void { this.message.set(message); this.amountError.set(true); this.amountInput?.nativeElement.focus(); }

  async loadMembers(): Promise<void> {
    const groupId = this.selectedGroupId;
    this.recipients.set([]); this.recipientId = ''; this.amount = ''; this.message.set(''); this.amountError.set(false);
    this.pendingKey = undefined; this.pendingBody = undefined;
    const group = this.groups.find(item => item.id === groupId);
    if (!group || !this.expenseService || !this.user) return;
    this.currency = group.currency;
    try {
      const members = await this.expenseService.members(groupId);
      if (this.selectedGroupId !== groupId) return;
      this.recipients.set(members.filter(member => member.status === 'active' && member.userId !== this.user?.uid));
      this.changeDetector.markForCheck();
    } catch { if (this.selectedGroupId === groupId) this.message.set('Membres indisponibles.'); }
  }

  async save(): Promise<void> {
    if (!this.settlementService || !this.user || !this.selectedGroupId || this.busy()) return;
    this.messageVariant.set('error');
    this.amountError.set(false);
    if (!this.recipients().some(member => member.userId === this.recipientId)) { this.message.set('Choisissez un membre actif.'); return; }
    let amountMinor: number;
    try { amountMinor = parseMinor(this.amount, this.currency); }
    catch (error) { this.rejectAmount(error instanceof Error ? error.message : 'Montant invalide'); return; }
    if (amountMinor <= 0) { this.rejectAmount('Montant positif requis.'); return; }
    const content = { date: this.date, currency: this.currency, amountMinor, fromUserId: this.user.uid, toUserId: this.recipientId };
    const serialized = JSON.stringify(content);
    if (serialized !== this.pendingBody) this.pendingKey = undefined;
    const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
    this.pendingKey = idempotencyKey; this.pendingBody = serialized;
    this.busy.set(true); this.message.set('');
    try {
      await this.settlementService.create(this.user, this.selectedGroupId, { idempotencyKey, ...content } satisfies SettlementRequest);
      this.pendingKey = undefined; this.pendingBody = undefined;
      this.amount = ''; this.messageVariant.set('success'); this.message.set('Remboursement enregistré.'); this.saved.emit();
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible'); }
    finally { this.busy.set(false); }
  }
}
