import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
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
  imports: [FieldComponent, DropdownComponent, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="t('exportGroup')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ t('exportGroup') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ t(kind === 'zip-v2' ? 'exportV2Partial' : 'exportPartial') }}</p>
      <div class="mt-5 space-y-4">
        <app-field class="block" controlId="exportGroup" [label]="t('group')"><app-dropdown controlId="exportGroup" [options]="groupDropdownOptions(groups, t('chooseGroup'), false)" name="exportGroup" [(ngModel)]="groupId" /></app-field>
        <app-field class="block" controlId="export-kind" [label]="t('exportFormat')">
          <app-dropdown controlId="export-kind" name="exportKind" [options]="exportKindOptions()" [(ngModel)]="kind" />
        </app-field>
        @if (kind === 'zip' || kind === 'zip-v2') { <p class="rounded-xl bg-pop-peach p-3 text-sm text-pop-text">{{ t('exportPrivate') }}</p> }
        @if (kind === 'zip-v2') { <p class="text-sm text-pop-muted">{{ t('exportV2Owner') }}</p> }
        <app-ui-button variant="primary"  type="button"
          [disabled]="busy() || !groupId || !user?.emailVerified || (kind === 'zip-v2' && !isOwner())" (click)="download()">
          {{ busy() ? t('exportPreparing') : t('exportDownload') }}
        </app-ui-button>
        @if (message(); as key) { <app-ui-alert [variant]="key === 'exportReady' ? 'success' : 'error'">{{ t(key) }}</app-ui-alert> }
      </div>
    </section>
  `,
})
export class ExportPanel {
  exportKindOptions(): DropdownOption[] { return [{ value: 'csv', label: this.t('exportCsv') }, { value: 'json', label: this.t('exportJson') }, { value: 'zip', label: this.t('exportZip') }, { value: 'zip-v2', label: this.t('exportZipV2') }]; }
  readonly groupDropdownOptions = groupDropdownOptions;
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
