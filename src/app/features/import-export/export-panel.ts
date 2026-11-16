import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { buildBackupPackageV1 } from './backup-package';
import { encodeBackupZipV1, encodeBackupZipV2 } from './backup-zip';
import { buildBackupPackageV2FromServerSnapshot } from './backup-package-v2';
import { collectGroupExportV1, FirebaseExportReader } from './export-collector';
import { serializeGroupLedgerCsvV1 } from './group-csv';
import type { GroupExportV1 } from './export-v1';
import { t, type MessageKey } from '../../shared/utils/i18n';

type ExportKind = 'csv' | 'json' | 'zip' | 'zip-v2';

@Component({
  selector: 'app-export-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('exportGroup')">
      <h2 class="text-lg font-semibold">{{ t('exportGroup') }}</h2>
      <p class="mt-2 text-sm text-slate-700">{{ t(kind === 'zip-v2' ? 'exportV2Partial' : 'exportPartial') }}</p>
      <div class="mt-4 space-y-3">
        <label class="block text-sm font-medium">{{ t('group') }}
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="exportGroup" [(ngModel)]="groupId">
            <option value="">{{ t('chooseGroup') }}</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        <label class="block text-sm font-medium">{{ t('exportFormat') }}
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="exportKind" [(ngModel)]="kind">
            <option value="csv">{{ t('exportCsv') }}</option>
            <option value="json">{{ t('exportJson') }}</option>
            <option value="zip">{{ t('exportZip') }}</option>
            <option value="zip-v2">{{ t('exportZipV2') }}</option>
          </select>
        </label>
        @if (kind === 'zip' || kind === 'zip-v2') { <p class="text-sm text-amber-800">{{ t('exportPrivate') }}</p> }
        @if (kind === 'zip-v2') { <p class="text-sm text-slate-700">{{ t('exportV2Owner') }}</p> }
        <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="button"
          [disabled]="busy() || !groupId || !user?.emailVerified || (kind === 'zip-v2' && !isOwner())" (click)="download()">
          {{ busy() ? t('exportPreparing') : t('exportDownload') }}
        </button>
        @if (message(); as key) { <p class="text-sm" role="status">{{ t(key) }}</p> }
      </div>
    </section>
  `,
})
export class ExportPanel {
  readonly t = t;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;

  readonly busy = signal(false);
  readonly message = signal<MessageKey | null>(null);
  groupId = '';
  kind: ExportKind = 'csv';

  isOwner(): boolean { return this.groups.some(group => group.id === this.groupId && group.ownerId === this.user?.uid); }

  async download(): Promise<void> {
    const user = this.user;
    const app = this.firebaseApp;
    const groupId = this.groupId;
    const kind = this.kind;
    if (this.busy() || !user?.emailVerified || !app || !this.groups.some(group => group.id === groupId) ||
        (kind === 'zip-v2' && !this.isOwner())) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const reader = new FirebaseExportReader(app);
      let bytes: Uint8Array;
      let extension: string;
      let contentType: string;
      if (kind === 'zip-v2') {
        if (!this.workerUrl) throw new Error(t('exportWorkerMissing'));
        const backup = await buildBackupPackageV2FromServerSnapshot(reader, user, groupId, this.workerUrl);
        bytes = await encodeBackupZipV2(backup);
        extension = 'zip'; contentType = 'application/zip';
      } else if (kind === 'zip') {
        if (!this.workerUrl) throw new Error(t('exportWorkerMissing'));
        const backup = await buildBackupPackageV1(reader, user, groupId, this.workerUrl);
        bytes = await encodeBackupZipV1(backup);
        extension = 'zip'; contentType = 'application/zip';
      } else {
        const json = await collectGroupExportV1(reader, user, groupId);
        const content = kind === 'csv' ? serializeGroupLedgerCsvV1(JSON.parse(json) as GroupExportV1) : json;
        bytes = new TextEncoder().encode(content);
        extension = kind; contentType = kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
      }
      if (this.groupId !== groupId || this.user?.uid !== user.uid) throw new Error(t('exportSelectionChanged'));
      // A fresh, owned ArrayBuffer avoids exposing a subarray or unsafe BlobPart type.
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: contentType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ourfinance-${groupId}-${kind === 'zip-v2' ? 'v2-partiel' : 'partiel'}-${new Date().toISOString().slice(0, 10)}.${extension}`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message.set('exportReady');
    } catch {
      this.message.set('exportFailed');
    } finally { this.busy.set(false); }
  }
}
