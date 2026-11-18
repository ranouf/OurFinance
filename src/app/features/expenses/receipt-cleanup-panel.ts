import { Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { ReceiptCleanupError, ReceiptCleanupService } from '../../core/firebase/receipt-cleanup-service';
import { expenseText } from './expense-text';

type CleanupMessage = 'receiptCleanupDone' | 'receiptCleanupEmpty' | 'receiptCleanupPending' |
  'receiptCleanupQuota' | 'receiptCleanupDenied' | 'receiptCleanupUnavailable';

@Component({
  selector: 'app-receipt-cleanup-panel',
  imports: [FormsModule],
  templateUrl: './receipt-cleanup-panel.html',
})
export class ReceiptCleanupPanel implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl?: string;

  readonly text = expenseText;
  readonly busy = signal(false);
  readonly message = signal<CleanupMessage | null>(null);
  readonly cleaned = signal(0);
  readonly pending = signal(0);
  groupId = '';

  ownerGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid); }

  ngOnChanges(): void {
    if (!this.ownerGroups().some(group => group.id === this.groupId)) this.groupId = this.ownerGroups()[0]?.id ?? '';
    this.message.set(null);
  }

  async run(): Promise<void> {
    const user = this.user;
    const groupId = this.groupId;
    if (this.busy() || !user?.emailVerified || !this.workerUrl || !this.ownerGroups().some(group => group.id === groupId)) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const result = await new ReceiptCleanupService(this.workerUrl).run(user, groupId);
      if (this.groupId !== groupId || this.user?.uid !== user.uid) return;
      this.cleaned.set(result.cleaned);
      this.pending.set(result.pending);
      this.message.set(result.status === 202 ? 'receiptCleanupPending' : result.cleaned ? 'receiptCleanupDone' : 'receiptCleanupEmpty');
    } catch (error) {
      if (this.groupId !== groupId || this.user?.uid !== user.uid) return;
      const code = error instanceof ReceiptCleanupError ? error.code : 'unavailable';
      this.message.set(code === 'quota' ? 'receiptCleanupQuota' : code === 'denied' ? 'receiptCleanupDenied' : 'receiptCleanupUnavailable');
    } finally { this.busy.set(false); }
  }
}
