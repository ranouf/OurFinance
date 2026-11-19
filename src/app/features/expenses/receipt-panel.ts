import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ReceiptService, type Receipt } from '../../core/firebase/receipt-service';
import { expenseMessage, expenseText } from './expense-text';

@Component({
  selector: 'app-receipt-panel', imports: [UiControlDirective, UiButton, UiAlert],
  template: `
    <section class="rounded-2xl border border-pop-border bg-pop-lavender p-4" [attr.aria-label]="text('privateReceipts')">
      <h3 class="font-extrabold text-pop-text">{{ text('privateReceipts') }}</h3>
      <p class="mt-1 text-pop-muted">{{ text('receiptHelp') }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <label class="flex min-h-11 cursor-pointer items-center rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark">
          {{ text('addReceipt') }}
          <input appUiControl class="sr-only" type="file" accept="image/png,image/jpeg" [disabled]="busy()" (change)="upload($event)" />
        </label>
        <app-ui-button variant="secondary"  type="button" [disabled]="busy()" (click)="refresh()">{{ text('refresh') }}</app-ui-button>
      </div>
      @if (receipts().length) {
        <ul class="mt-3 space-y-2">
          @for (receipt of receipts(); track receipt.id; let i = $index) {
            <li class="flex flex-wrap items-center gap-2 rounded-xl bg-pop-surface p-3">
              <span>{{ text('receipt') }} {{ i + 1 }}</span>
              <app-ui-button variant="outline"  type="button" [disabled]="busy()" (click)="view(receipt)">{{ text('view') }}</app-ui-button>
              @if (receipt.ownerId === user?.uid || groupOwnerId === user?.uid) { <app-ui-button variant="outline"  type="button" [disabled]="busy()" (click)="remove(receipt)">{{ text('remove') }}</app-ui-button> }
            </li>
          }
        </ul>
      } @else if (!busy()) { <p class="mt-2 text-pop-muted">{{ text('noReceipts') }}</p> }
      @if (imageUrl()) {
        <div class="mt-3">
          <img class="max-h-96 max-w-full rounded-xl border border-pop-border object-contain" [src]="imageUrl()" [alt]="text('privateReceipts')" />
          <app-ui-button variant="secondary" class="mt-2" type="button" (click)="closeImage()">{{ text('closeReceipt') }}</app-ui-button>
        </div>
      }
      @if (message()) { <app-ui-alert variant="info" class="mt-2">{{ displayMessage(message()) }}</app-ui-alert> }
    </section>
  `,
})
export class ReceiptPanel implements OnChanges, OnDestroy {
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) groupId = '';
  @Input({ required: true }) expenseId = '';
  @Input({ required: true }) groupOwnerId = '';
  readonly receipts = signal<Receipt[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly imageUrl = signal('');
  readonly text = expenseText;
  readonly displayMessage = expenseMessage;
  private service?: ReceiptService;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new ReceiptService(this.firebaseApp, this.workerUrl);
    if (changes['groupId'] || changes['expenseId']) { this.closeImage(); void this.refresh(); }
  }
  ngOnDestroy(): void { this.closeImage(); }
  closeImage(): void { if (this.imageUrl()) URL.revokeObjectURL(this.imageUrl()); this.imageUrl.set(''); }

  async refresh(): Promise<void> {
    if (!this.service || !this.groupId || !this.expenseId) return;
    this.busy.set(true);
    try { this.receipts.set(await this.service.list(this.groupId, this.expenseId)); this.message.set(''); }
    catch { this.message.set('receiptsUnavailable'); }
    finally { this.busy.set(false); }
  }

  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.service || !this.user) return;
    this.busy.set(true);
    try { await this.service.upload(this.user, this.groupId, this.expenseId, file); this.message.set('receiptAdded'); this.receipts.set(await this.service.list(this.groupId, this.expenseId)); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'receiptAddFailed'); }
    finally { this.busy.set(false); }
  }

  async view(receipt: Receipt): Promise<void> {
    if (!this.service || !this.user) return;
    this.busy.set(true);
    try { const image = await this.service.read(this.user, this.groupId, this.expenseId, receipt.id); this.closeImage(); this.imageUrl.set(URL.createObjectURL(image)); this.message.set(''); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'receiptReadFailed'); }
    finally { this.busy.set(false); }
  }

  async remove(receipt: Receipt): Promise<void> {
    if (!this.service || !this.user) return;
    this.busy.set(true);
    try { await this.service.remove(this.user, this.groupId, this.expenseId, receipt.id); this.closeImage(); this.receipts.set(this.receipts().filter(item => item.id !== receipt.id)); this.message.set('receiptRemoved'); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'receiptRemoveFailed'); }
    finally { this.busy.set(false); }
  }
}
