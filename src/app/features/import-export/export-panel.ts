import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { buildBackupPackageV1 } from './backup-package';
import { encodeBackupZipV1 } from './backup-zip';
import { collectGroupExportV1, FirebaseExportReader } from './export-collector';
import { serializeGroupLedgerCsvV1 } from './group-csv';
import type { GroupExportV1 } from './export-v1';
import { t, type MessageKey } from '../../shared/utils/i18n';

type ExportKind = 'csv' | 'json' | 'zip';

@Component({
  selector: 'app-export-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="t('exportGroup')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ t('exportGroup') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ t('exportPartial') }}</p>
      <div class="mt-5 space-y-4">
        <label class="block text-sm font-bold">{{ t('group') }}
          <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="exportGroup" [(ngModel)]="groupId">
            <option value="">{{ t('chooseGroup') }}</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        <label class="block text-sm font-bold">{{ t('exportFormat') }}
          <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="exportKind" [(ngModel)]="kind">
            <option value="csv">{{ t('exportCsv') }}</option>
            <option value="json">{{ t('exportJson') }}</option>
            <option value="zip">{{ t('exportZip') }}</option>
          </select>
        </label>
        @if (kind === 'zip') { <p class="rounded-xl bg-pop-peach p-3 text-sm text-pop-text">{{ t('exportPrivate') }}</p> }
        <button class="min-h-11 rounded-xl bg-pop-primary px-5 py-2 font-bold text-white hover:bg-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary disabled:opacity-50" type="button"
          [disabled]="busy() || !groupId || !user?.emailVerified" (click)="download()">
          {{ busy() ? t('exportPreparing') : t('exportDownload') }}
        </button>
        @if (message(); as key) { <p class="rounded-xl bg-pop-lavender p-3 text-sm" role="status">{{ t(key) }}</p> }
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

  async download(): Promise<void> {
    const user = this.user;
    const app = this.firebaseApp;
    const groupId = this.groupId;
    const kind = this.kind;
    if (this.busy() || !user?.emailVerified || !app || !this.groups.some(group => group.id === groupId)) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const reader = new FirebaseExportReader(app);
      let bytes: Uint8Array;
      let extension: string;
      let contentType: string;
      if (kind === 'zip') {
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
      anchor.download = `ourfinance-${groupId}-partiel-${new Date().toISOString().slice(0, 10)}.${extension}`;
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
