import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { t } from '../../shared/utils/i18n';
import { decodeBackupZipV2 } from './backup-zip-read';
import { FirebaseExportReader } from './export-collector';
import { preflightBackupRestoreV2, type RestorePreflightV2 } from './restore-preflight-v2';

interface RestoreDiffCounts { readonly create: number; readonly replace: number; readonly delete: number }

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
            @if (diff(); as changes) {
              <p class="mt-3 font-semibold">{{ t('restoreChanges') }}</p>
              <p>{{ t('restoreCreate') }} : {{ changes.create }} · {{ t('restoreOverwrite') }} : {{ changes.replace }} · {{ t('restoreDelete') }} : {{ changes.delete }}</p>
              <p class="mt-1">{{ t('restoreChangesNote') }}</p>
            }
            <p class="mt-3">{{ t('restoreConfirmHelp') }}</p>
            <label class="mt-2 block font-medium">{{ t('groupName') }}
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="text" name="restoreConfirmation"
                [(ngModel)]="confirmation" autocomplete="off" />
            </label>
            <button class="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-white disabled:opacity-50" type="button"
              [disabled]="busy() || !diff() || confirmation !== selectedGroupName()" (click)="restore()">{{ t('restoreAction') }}</button>
          </div>
        }
        @if (message()) {
          <p class="text-sm" role="status">{{ t(message()!) }}
            @if (message() === 'restoreUncertain') { <span class="break-all">{{ attemptId() }}</span> }
          </p>
          @if (message() === 'restoreDone' || message() === 'restoreCleanupPending') {
            <button class="rounded-lg border border-teal-700 px-4 py-2 text-teal-800" type="button"
              (click)="reload()">{{ t('restoreReload') }}</button>
            @if (message() === 'restoreCleanupPending') {
              <button class="ml-2 rounded-lg border border-teal-700 px-4 py-2 text-teal-800 disabled:opacity-50" type="button"
                [disabled]="busy()" (click)="retryCleanup()">{{ t('restoreCleanupRetry') }}</button>
            }
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
  readonly diff = signal<RestoreDiffCounts | null>(null);
  readonly message = signal<'restoreInvalid' | 'restoreUnavailable' | 'restoreDone' | 'restoreCleanupPending' | 'restoreUncertain' | null>(null);
  readonly attemptId = signal('');
  groupId = '';
  confirmation = '';
  selectedFile?: File;
  private archive?: Uint8Array;
  private previewGroupId?: string;
  private previewUid?: string;
  private attemptGroupId?: string;

  selectedGroupName(): string { return this.groups.find(group => group.id === this.groupId)?.name ?? ''; }
  reload(): void { window.location.reload(); }
  clearPreview(): void {
    this.preview.set(null);
    this.diff.set(null);
    this.archive = undefined;
    this.confirmation = '';
    this.message.set(null);
    this.attemptId.set('');
    this.attemptGroupId = undefined;
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
    if (this.busy() || !group || !user?.emailVerified || user.uid !== group.ownerId || !app || !file || !this.workerUrl) return;
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
      const previewUrl = new URL(`/groups/${encodeURIComponent(group.id)}/backup/preview`, this.workerUrl);
      if (previewUrl.protocol !== 'https:') throw new Error('insecure_url');
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const response = await fetch(previewUrl, {
        method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/zip' },
        body: copy.buffer, cache: 'no-store',
      });
      if (!response.ok) throw new Error(response.status === 503 ? 'preview_unavailable' : 'invalid_preview');
      const changes = await response.json() as RestoreDiffCounts;
      if (![changes.create, changes.replace, changes.delete].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('invalid_preview');
      if (this.groupId !== group.id || this.user?.uid !== user.uid || this.selectedFile !== file) throw new Error('selection_changed');
      this.archive = bytes;
      this.previewGroupId = group.id;
      this.previewUid = user.uid;
      this.preview.set(plan);
      this.diff.set(changes);
    } catch (error) { this.message.set(error instanceof Error && error.message === 'preview_unavailable' ? 'restoreUnavailable' : 'restoreInvalid'); }
    finally { this.busy.set(false); }
  }

  async restore(): Promise<void> {
    const user = this.user;
    const group = this.groups.find(item => item.id === this.groupId);
    if (this.busy() || !user?.emailVerified || !group || user.uid !== group.ownerId || !this.archive || !this.preview() || !this.diff() ||
        !this.workerUrl || this.confirmation !== group.name || this.previewGroupId !== group.id || this.previewUid !== user.uid) return;
    const archive = this.archive;
    this.busy.set(true);
    this.message.set(null);
    const restoreId = crypto.randomUUID();
    this.attemptId.set(restoreId);
    this.attemptGroupId = group.id;
    try {
      const url = new URL(`/groups/${encodeURIComponent(group.id)}/backup/restores/${restoreId}`, this.workerUrl);
      if (url.protocol !== 'https:') throw new Error('insecure_url');
      const token = await user.getIdToken();
      const sendZip = async (path: string): Promise<Response> => {
        const copy = new Uint8Array(archive.byteLength);
        copy.set(archive);
        return fetch(new URL(path, url), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
          body: copy.buffer, cache: 'no-store' });
      };
      const contents = await decodeBackupZipV2(archive);
      let response: Response;
      if (contents.receipts.length > 25) {
        const prepared = await sendZip(`${url.pathname}/prepare`);
        if (prepared.status !== 201) throw new Error('prepare_failed');
        for (const [index, receipt] of contents.receipts.entries()) {
          const copy = new Uint8Array(receipt.bytes.byteLength);
          copy.set(receipt.bytes);
          const staged = await fetch(new URL(`${url.pathname}/receipts/${index}`, url), { method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': receipt.contentType }, body: copy.buffer, cache: 'no-store' });
          if (!staged.ok) throw new Error('stage_failed');
        }
        response = await sendZip(`${url.pathname}/commit`);
      } else {
        response = await sendZip(url.pathname);
      }
      if (response.status === 200 || response.status === 202) {
        this.clearPreview();
        this.attemptId.set(restoreId);
        this.attemptGroupId = group.id;
        this.message.set(response.status === 202 ? 'restoreCleanupPending' : 'restoreDone');
      } else {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        this.message.set(body?.error === 'recovery_required' ? 'restoreUncertain' :
          response.status === 503 ? 'restoreUnavailable' : 'restoreInvalid');
      }
    } catch { this.message.set('restoreUncertain'); }
    finally { this.busy.set(false); }
  }

  async retryCleanup(): Promise<void> {
    const user = this.user;
    const restoreId = this.attemptId();
    const groupId = this.attemptGroupId;
    if (this.busy() || !user?.emailVerified || !groupId || !restoreId || !this.workerUrl || this.message() !== 'restoreCleanupPending') return;
    this.busy.set(true);
    try {
      const url = new URL(`/groups/${encodeURIComponent(groupId)}/backup/restores/${restoreId}/cleanup`, this.workerUrl);
      if (url.protocol !== 'https:') throw new Error('insecure_url');
      const token = await user.getIdToken();
      for (let index = 0; index < 50; index++) {
        const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (response.status === 204) { this.message.set('restoreDone'); return; }
        if (response.status !== 202) throw new Error('cleanup_failed');
      }
      this.message.set('restoreCleanupPending');
    } catch { this.message.set('restoreCleanupPending'); }
    finally { this.busy.set(false); }
  }
}
