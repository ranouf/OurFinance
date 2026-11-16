import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { t } from '../../shared/utils/i18n';
import { decodeBackupZipV2 } from './backup-zip-read';
import { FirebaseExportReader } from './export-collector';
import { preflightBackupRestoreV2, type RestorePreflightV2 } from './restore-preflight-v2';

@Component({
  selector: 'app-restore-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('restoreHeading')">
      <h2 class="text-lg font-semibold">{{ t('restoreHeading') }}</h2>
      <p class="mt-2 text-sm text-slate-700">{{ t('restorePartial') }}</p>
      <div class="mt-4 space-y-3">
        <label class="block text-sm font-medium">{{ t('group') }}
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="restoreGroup"
            [(ngModel)]="groupId" (ngModelChange)="clearPreview()">
            <option value="">{{ t('chooseGroup') }}</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        <label class="block text-sm font-medium">{{ t('restoreFile') }}
          <input class="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-3 text-sm" type="file"
            accept=".zip,application/zip" (change)="selectFile($event)" />
        </label>
        <button class="rounded-lg border border-teal-700 px-4 py-2 text-teal-800 disabled:opacity-50" type="button"
          [disabled]="busy() || !groupId || !selectedFile || !user?.emailVerified" (click)="previewFile()">
          {{ busy() ? t('exportPreparing') : t('restorePreview') }}
        </button>
        @if (preview(); as plan) {
          <div class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p class="font-semibold">{{ t('restoreReplace') }}</p>
            <p class="mt-1 break-all">{{ selectedGroupName() }} · {{ plan.sourceExportedAt }}</p>
            <ul class="mt-2 list-inside list-disc">
              <li>{{ t('restoreExpenses') }} : {{ plan.expenseCount }}</li>
              <li>{{ t('restoreSettlements') }} : {{ plan.settlementCount }}</li>
              <li>{{ t('restoreImports') }} : {{ plan.importCount }}</li>
              <li>{{ t('restoreComments') }} : {{ plan.commentCount }}</li>
              <li>{{ t('restoreReceipts') }} : {{ plan.receiptCount }}</li>
              <li>{{ t('restorePreferences') }} : {{ plan.preferenceCount }} + {{ plan.absentPreferenceCount }} {{ t('restoreAbsent') }}</li>
            </ul>
            <p class="mt-3">{{ t('restoreConfirmHelp') }}</p>
            <label class="mt-2 block font-medium">{{ t('groupName') }}
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="text" name="restoreConfirmation"
                [(ngModel)]="confirmation" autocomplete="off" />
            </label>
            <button class="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-white disabled:opacity-50" type="button"
              [disabled]="busy() || confirmation !== selectedGroupName()" (click)="restore()">{{ t('restoreAction') }}</button>
          </div>
        }
        @if (message()) {
          <p class="text-sm" role="status">{{ t(message()!) }}
            @if (message() === 'restoreUncertain') { <span class="break-all">{{ attemptId() }}</span> }
          </p>
          @if (message() === 'restoreDone' || message() === 'restoreCleanupPending') {
            <button class="rounded-lg border border-teal-700 px-4 py-2 text-teal-800" type="button"
              (click)="reload()">{{ t('restoreReload') }}</button>
          }
        }
      </div>
    </section>
  `,
})
export class RestorePanel {
  readonly t = t;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;

  readonly busy = signal(false);
  readonly preview = signal<RestorePreflightV2 | null>(null);
  readonly message = signal<'restoreInvalid' | 'restoreUnavailable' | 'restoreDone' | 'restoreCleanupPending' | 'restoreUncertain' | null>(null);
  readonly attemptId = signal('');
  groupId = '';
  confirmation = '';
  selectedFile?: File;
  private archive?: Uint8Array;
  private previewGroupId?: string;
  private previewUid?: string;

  selectedGroupName(): string { return this.groups.find(group => group.id === this.groupId)?.name ?? ''; }
  reload(): void { window.location.reload(); }
  clearPreview(): void {
    this.preview.set(null);
    this.archive = undefined;
    this.confirmation = '';
    this.message.set(null);
    this.attemptId.set('');
  }
  selectFile(event: Event): void {
    this.selectedFile = (event.target as HTMLInputElement).files?.[0];
    this.clearPreview();
  }

  async previewFile(): Promise<void> {
    const group = this.groups.find(item => item.id === this.groupId);
    const user = this.user;
    const app = this.firebaseApp;
    const file = this.selectedFile;
    if (this.busy() || !group || !user?.emailVerified || user.uid !== group.ownerId || !app || !file) return;
    this.busy.set(true);
    this.clearPreview();
    try {
      if (file.size > 20_000_000) throw new Error('archive_too_large');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const backup = await decodeBackupZipV2(bytes);
      const reader = new FirebaseExportReader(app);
      const [root, members] = await Promise.all([reader.read(`groups/${group.id}`), reader.list(`groups/${group.id}/members`)]);
      if (root?.data['status'] !== 'active' || root.data['ownerId'] !== user.uid ||
          !members.some(member => member.id === user.uid && member.data['status'] === 'active' && member.data['role'] === 'owner')) {
        throw new Error('owner_required');
      }
      const plan = await preflightBackupRestoreV2(backup, {
        groupId: group.id, currency: group.currency, ownerId: group.ownerId,
        memberIds: members.map(member => member.id),
        memberStatuses: Object.fromEntries(members.map(member => [member.id, member.data['status']])) as Record<string, 'active' | 'revoked'>,
      });
      if (this.groupId !== group.id || this.user?.uid !== user.uid || this.selectedFile !== file) throw new Error('selection_changed');
      this.archive = bytes;
      this.previewGroupId = group.id;
      this.previewUid = user.uid;
      this.preview.set(plan);
    } catch { this.message.set('restoreInvalid'); }
    finally { this.busy.set(false); }
  }

  async restore(): Promise<void> {
    const user = this.user;
    const group = this.groups.find(item => item.id === this.groupId);
    if (this.busy() || !user?.emailVerified || !group || user.uid !== group.ownerId || !this.archive || !this.preview() ||
        !this.workerUrl || this.confirmation !== group.name || this.previewGroupId !== group.id || this.previewUid !== user.uid) return;
    const archive = this.archive;
    this.busy.set(true);
    this.message.set(null);
    const restoreId = crypto.randomUUID();
    this.attemptId.set(restoreId);
    try {
      const url = new URL(`/groups/${encodeURIComponent(group.id)}/backup/restores/${restoreId}`, this.workerUrl);
      if (url.protocol !== 'https:') throw new Error('insecure_url');
      const copy = new Uint8Array(archive.byteLength);
      copy.set(archive);
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/zip' },
        body: copy.buffer, cache: 'no-store',
      });
      if (response.status === 200 || response.status === 202) {
        this.clearPreview();
        this.message.set(response.status === 202 ? 'restoreCleanupPending' : 'restoreDone');
      } else {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        this.message.set(body?.error === 'recovery_required' ? 'restoreUncertain' :
          response.status === 503 ? 'restoreUnavailable' : 'restoreInvalid');
      }
    } catch { this.message.set('restoreUncertain'); }
    finally { this.busy.set(false); }
  }
}
