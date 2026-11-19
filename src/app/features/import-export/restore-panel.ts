import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { Component, ElementRef, Input, OnChanges, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { t } from '../../shared/utils/i18n';
import { decodeBackupZipV2 } from './backup-zip-read';
import { FirebaseExportReader } from './export-collector';
import { restoreFailure, type RestoreFailureMessage } from './restore-failure';
import { RestoreAttemptStore } from './restore-attempt-store';
import { preflightBackupRestoreV2, type RestorePreflightV2 } from './restore-preflight-v2';
import { RestoreService } from './restore-service';

interface RestoreDiffCounts { readonly create: number; readonly replace: number; readonly delete: number }

@Component({
  selector: 'app-restore-panel',
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('restoreHeading')">
      <h2 class="text-lg font-semibold">{{ t('restoreHeading') }}</h2>
      <p class="mt-2 text-sm text-slate-700">{{ t('restorePartial') }}</p>
@if (!ownedGroups().length && !outcomePending()) {
        <p class="mt-4 text-sm">{{ t('restoreOwnerOnly') }}</p>
      } @else {
      <div class="mt-4 space-y-3">
        <app-field class="block" controlId="restoreGroup" [label]="t('group')"><app-dropdown controlId="restoreGroup" [options]="groupDropdownOptions(ownedGroups(), t('chooseGroup'), false)" name="restoreGroup" [disabled]="outcomePending()"
            [(ngModel)]="groupId" (ngModelChange)="clearPreview()" /></app-field>
        <label class="block text-sm font-medium">{{ t('restoreFile') }}
          <input #restoreFileInput appUiControl class="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pop-primary-dark" type="file" [disabled]="outcomePending()"
            accept=".zip,application/zip" [attr.aria-invalid]="message() === 'restoreInvalid' ? 'true' : null" [attr.aria-describedby]="message() === 'restoreInvalid' ? 'restoreFeedback' : null" (change)="selectFile($event)" />
        </label>
        <app-ui-button variant="outline"  type="button"
          [disabled]="busy() || outcomePending() || !groupId || !selectedFile || !user?.emailVerified" (click)="previewFile()">
          {{ busy() ? t('exportPreparing') : t('restorePreview') }}
        </app-ui-button>
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
              <li>{{ t('restorePreferences') }} : {{ plan.preferenceCount }} · {{ t('restoreAbsent') }} : {{ plan.absentPreferenceCount }}</li>
            </ul>
            @if (diff(); as changes) {
              <p class="mt-3 font-semibold">{{ t('restoreChanges') }}</p>
              <p>{{ t('restoreCreate') }} : {{ changes.create }} · {{ t('restoreOverwrite') }} : {{ changes.replace }} · {{ t('restoreDelete') }} : {{ changes.delete }}</p>
              <p class="mt-1">{{ t('restoreChangesNote') }}</p>
            }
            <p class="mt-3">{{ t('restoreConfirmHelp') }}</p>
            <label class="mt-2 block font-medium">{{ t('groupName') }}
              <input appUiControl class="mt-1 w-full" type="text" name="restoreConfirmation"
                [(ngModel)]="confirmation" autocomplete="off" />
            </label>
            <app-ui-button variant="danger" class="mt-3" type="button"
              [disabled]="busy() || !diff() || confirmation !== selectedGroupName() || outcomePending()"
              (click)="restore()">{{ t('restoreAction') }}</app-ui-button>
          </div>
        }
        @if (message()) {
          <app-ui-alert id="restoreFeedback" [variant]="feedbackVariant()" class="block">{{ t(message()!) }}
            @if (outcomePending() || message() === 'restorePreparedUncertain' || message() === 'restorePreparedQuota') { <span class="break-all">{{ attemptId() }}</span> }
          </app-ui-alert>
          @if (message() === 'restorePreparedUncertain' || message() === 'restorePreparedQuota') {
            <app-ui-button variant="outline"  type="button"
              [disabled]="busy()" (click)="restore()">{{ t(message() === 'restorePreparedQuota' ? 'restoreQuotaRetry' : 'restorePreparedRetry') }}</app-ui-button>
          }
          @if (outcomePending()) {
            <app-ui-button variant="outline" type="button" [disabled]="busy()" (click)="checkOutcome()">{{ t('restoreCheckOutcome') }}</app-ui-button>
          }
          @if (message() === 'restoreDone' || message() === 'restoreCleanupPending' || message() === 'restoreCleanupQuota') {
            <app-ui-button variant="outline"  type="button"
              (click)="reload()">{{ t('restoreReload') }}</app-ui-button>
            @if (message() === 'restoreCleanupPending' || message() === 'restoreCleanupQuota') {
              <app-ui-button variant="outline" class="ml-2" type="button"
                [disabled]="busy()" (click)="retryCleanup()">{{ t('restoreCleanupRetry') }}</app-ui-button>
            }
          }
        }
      </div>
      }
    </section>
  `,
})
export class RestorePanel implements OnChanges {
  @ViewChild('restoreFileInput') private fileInput?: ElementRef<HTMLInputElement>;
  readonly groupDropdownOptions = groupDropdownOptions;
  readonly t = t;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;

  readonly busy = signal(false);
  readonly preview = signal<RestorePreflightV2 | null>(null);
  readonly diff = signal<RestoreDiffCounts | null>(null);
  readonly message = signal<RestoreFailureMessage | 'restoreDone' | 'restoreCleanupPending' | 'restoreCleanupQuota' | 'restoreStillLocked' | 'restoreOutcomeUnavailable' | null>(null);
  readonly attemptId = signal('');
  groupId = '';
  confirmation = '';
  selectedFile?: File;
  private archive?: Uint8Array;
  private previewGroupId?: string;
  private previewUid?: string;
  private attemptGroupId?: string;
  private preparedAttemptId?: string;
  private commitAttemptId?: string;
  private readonly attemptStore = new RestoreAttemptStore();
  private recoveredUid?: string;

  ngOnChanges(): void {
    const user = this.user;
    if (!user?.emailVerified || !this.workerUrl || !this.groups.length || this.recoveredUid === user.uid) return;
    this.recoveredUid = user.uid;
    const pending = this.attemptStore.find(user.uid, this.groups.map(group => group.id));
    if (!pending) return;
    this.groupId = pending.groupId;
    this.attemptId.set(pending.restoreId);
    this.attemptGroupId = pending.groupId;
    this.message.set('restoreUncertain');
    void this.checkOutcome();
  }

  ownedGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid); }
  selectedGroupName(): string { return this.groups.find(group => group.id === this.groupId)?.name ?? ''; }
  outcomePending(): boolean { return ['restoreUncertain', 'restoreQuotaUncertain', 'restoreStillLocked', 'restoreOutcomeUnavailable'].includes(this.message() ?? ''); }
  feedbackVariant(): 'error' | 'warning' | 'success' {
    const message = this.message();
    return message === 'restoreDone' ? 'success' : message?.includes('Quota') || message?.includes('Uncertain') || message === 'restoreStillLocked' || message === 'restoreCleanupPending' ? 'warning' : 'error';
  }
  reload(): void { window.location.reload(); }
  clearPreview(): void {
    if (this.outcomePending()) { this.groupId = this.attemptGroupId ?? this.groupId; return; }
    this.preview.set(null);
    this.diff.set(null);
    this.archive = undefined;
    this.confirmation = '';
    this.message.set(null);
    this.attemptId.set('');
    this.attemptGroupId = undefined;
    this.preparedAttemptId = undefined;
    this.commitAttemptId = undefined;
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
      const response = await new RestoreService(this.workerUrl).preview(user, group.id, bytes);
      if (!response.ok) throw new Error(await restoreFailure(response, false));
      const changes = await response.json() as RestoreDiffCounts;
      if (![changes.create, changes.replace, changes.delete].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('invalid_preview');
      if (this.groupId !== group.id || this.user?.uid !== user.uid || this.selectedFile !== file) throw new Error('selection_changed');
      this.archive = bytes;
      this.previewGroupId = group.id;
      this.previewUid = user.uid;
      this.preview.set(plan);
      this.diff.set(changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.message.set(message === 'restoreQuota' ? 'restoreQuota' : message === 'restoreUnavailable' ? 'restoreUnavailable' : 'restoreInvalid');
      if (this.message() === 'restoreInvalid') this.fileInput?.nativeElement.focus();
    }
    finally { this.busy.set(false); }
  }

  async restore(): Promise<void> {
    const user = this.user;
    const group = this.groups.find(item => item.id === this.groupId);
    if (this.busy() || this.outcomePending() ||
        !user?.emailVerified || !group || user.uid !== group.ownerId || !this.archive || !this.preview() || !this.diff() ||
        !this.workerUrl || this.confirmation !== group.name || this.previewGroupId !== group.id || this.previewUid !== user.uid) return;
    const archive = this.archive;
    const retryPrepared = (this.message() === 'restorePreparedUncertain' || this.message() === 'restorePreparedQuota') &&
      this.preview()?.receiptCount && this.preview()!.receiptCount > 25;
    let commitSubmitted = false;
    this.busy.set(true);
    this.message.set(null);
    const restoreId = retryPrepared && this.attemptId() ? this.attemptId() : crypto.randomUUID();
    this.attemptId.set(restoreId);
    this.attemptGroupId = group.id;
    try {
      const service = new RestoreService(this.workerUrl);
      const token = await user.getIdToken();
      const sendZip = (step: 'restore' | 'prepare' | 'commit'): Promise<Response> =>
        service.postArchive(token, group.id, restoreId, step, archive);
      const contents = await decodeBackupZipV2(archive);
      let response: Response;
      if (contents.receipts.length > 25) {
        if (this.preparedAttemptId !== restoreId && this.commitAttemptId !== restoreId) {
          const prepared = await sendZip('prepare');
          if (prepared.status !== 201) throw new Error(await restoreFailure(prepared, true));
          this.preparedAttemptId = restoreId;
        }
        if (this.commitAttemptId !== restoreId) {
          for (const [index, receipt] of contents.receipts.entries()) {
            const staged = await service.stageReceipt(token, group.id, restoreId, index, receipt.contentType, receipt.bytes);
            if (!staged.ok) throw new Error(await restoreFailure(staged, true));
          }
          this.commitAttemptId = restoreId;
        }
        commitSubmitted = true;
        this.attemptStore.remember(user.uid, group.id, restoreId);
        response = await sendZip('commit');
      } else {
        commitSubmitted = true;
        this.attemptStore.remember(user.uid, group.id, restoreId);
        response = await sendZip('restore');
      }
      if (response.status === 200 || response.status === 202) {
        if (response.status === 200) this.attemptStore.forget(user.uid, group.id, restoreId);
        this.clearPreview();
        this.attemptId.set(restoreId);
        this.attemptGroupId = group.id;
        this.message.set(response.status === 202 ? 'restoreCleanupPending' : 'restoreDone');
      } else {
        const body = await response.clone().json().catch(() => null) as { error?: string } | null;
        if (body?.error === 'receipts_not_staged') {
          this.commitAttemptId = undefined;
          this.attemptStore.forget(user.uid, group.id, restoreId);
        }
        this.message.set(body?.error === 'receipts_not_staged' ? 'restorePreparedUncertain' :
          await restoreFailure(response, contents.receipts.length > 25, true));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.message.set(commitSubmitted || message === 'restoreUncertain' ? 'restoreUncertain' :
        message === 'restorePreparedQuota' ? 'restorePreparedQuota' :
        this.preview()?.receiptCount && this.preview()!.receiptCount > 25 ? 'restorePreparedUncertain' : 'restoreUncertain');
    }
    finally { this.busy.set(false); }
  }

  async checkOutcome(): Promise<void> {
    const user = this.user;
    const restoreId = this.attemptId();
    const groupId = this.attemptGroupId;
    if (this.busy() || !this.outcomePending() || !user?.emailVerified || !groupId || !restoreId ||
        this.groupId !== groupId || !this.workerUrl) return;
    this.busy.set(true);
    try {
      const token = await user.getIdToken();
      const service = new RestoreService(this.workerUrl);
      const response = await service.outcome(token, groupId, restoreId);
      if (this.user?.uid !== user.uid || this.groupId !== groupId || this.attemptId() !== restoreId) return;
      if (response.ok) {
        const result = await response.json() as { restoreId?: string; outcome?: string };
        if (result.restoreId !== restoreId) throw new Error('restore_id_mismatch');
        if (result.outcome === 'committed') {
          const current = await service.current(token, groupId);
          if (!current.ok) throw new Error('restore_state_unavailable');
          const state = await current.json() as { status?: string; restoreId?: string };
          if (this.user?.uid !== user.uid || this.groupId !== groupId || this.attemptId() !== restoreId) return;
          if (state.status === 'cleanup_pending' && state.restoreId === restoreId) this.message.set('restoreCleanupPending');
          else if (state.status === 'active') {
            this.attemptStore.forget(user.uid, groupId, restoreId);
            this.message.set(null);
            this.clearPreview();
            this.message.set('restoreDone');
          } else this.message.set('restoreOutcomeUnavailable');
        } else this.message.set(result.outcome === 'locked' ? 'restoreStillLocked' : 'restoreOutcomeUnavailable');
      } else this.message.set('restoreOutcomeUnavailable');
    } catch {
      if (this.user?.uid === user.uid && this.groupId === groupId && this.attemptId() === restoreId)
        this.message.set('restoreOutcomeUnavailable');
    }
    finally { this.busy.set(false); }
  }

  async retryCleanup(): Promise<void> {
    const user = this.user;
    const restoreId = this.attemptId();
    const groupId = this.attemptGroupId;
    if (this.busy() || !user?.emailVerified || !groupId || !restoreId || !this.workerUrl ||
        (this.message() !== 'restoreCleanupPending' && this.message() !== 'restoreCleanupQuota')) return;
    this.busy.set(true);
    try {
      const service = new RestoreService(this.workerUrl);
      const token = await user.getIdToken();
      for (let index = 0; index < 50; index++) {
        const response = await service.cleanup(token, groupId, restoreId);
        if (response.status === 204) { this.attemptStore.forget(user.uid, groupId, restoreId); this.message.set('restoreDone'); return; }
        if (response.status !== 202) {
          const failure = await restoreFailure(response, false);
          if (failure === 'restoreQuota') { this.message.set('restoreCleanupQuota'); return; }
          throw new Error('cleanup_failed');
        }
      }
      this.message.set('restoreCleanupPending');
    } catch { this.message.set('restoreCleanupPending'); }
    finally { this.busy.set(false); }
  }
}
