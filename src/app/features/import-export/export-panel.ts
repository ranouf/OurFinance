import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { buildBackupPackageV1 } from './backup-package';
import { buildBackupPackageV2 } from './backup-package-v2';
import { encodeBackupZipV1 } from './backup-zip';
import { encodeBackupZipV2 } from './backup-zip-v2';
import { previewBackupRestoreV2, type BackupRestorePreviewV2 } from './backup-restore-preview-v2';
import { collectGroupExportV1, FirebaseExportReader } from './export-collector';
import { collectGroupExportV2 } from './export-collector-v2';
import { serializeGroupLedgerCsvV1 } from './group-csv';
import type { GroupExportV1 } from './export-v1';

type ExportKind = 'csv' | 'json' | 'json-v2' | 'zip' | 'zip-v2';

@Component({
  selector: 'app-export-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Exporter un groupe">
      <h2 class="text-lg font-semibold">Exporter un groupe</h2>
      <p class="mt-2 text-sm text-slate-700">Ces exports sont partiels et ne restaurent pas encore le groupe. JSON et ZIP V2 incluent les remboursements interdevises ; les formats V1 les omettent. Comptes, préférences, commentaires et activité restent absents.</p>
      <div class="mt-4 space-y-3">
        <label class="block text-sm font-medium">Groupe
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="exportGroup" [(ngModel)]="groupId">
            <option value="">Choisir un groupe</option>
            @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
          </select>
        </label>
        <label class="block text-sm font-medium">Format
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="exportKind" [(ngModel)]="kind">
            <option value="csv">CSV de consultation</option>
            <option value="json">JSON du groupe, partiel</option>
            <option value="json-v2">JSON V2 avec remboursements multidevises, partiel</option>
            <option value="zip">ZIP du groupe avec reçus privés, partiel</option>
            <option value="zip-v2">ZIP V2 avec reçus privés et remboursements multidevises, partiel</option>
          </select>
        </label>
        @if (kind === 'zip' || kind === 'zip-v2') { <p class="text-sm text-amber-800">Le ZIP contient des reçus privés. Conservez le fichier dans un emplacement sûr.</p> }
        <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="button"
          [disabled]="busy() || !groupId || !user?.emailVerified" (click)="download()">
          {{ busy() ? 'Préparation…' : 'Télécharger l’export' }}
        </button>
        @if (message()) { <p class="text-sm" role="status">{{ message() }}</p> }
      </div>
      <div class="mt-6 border-t border-slate-200 pt-4">
        <h3 class="font-semibold">Examiner un ZIP V2 avant restauration</h3>
        <p class="mt-1 text-sm text-slate-600">Vérification locale, sans envoi ni écriture. La restauration n’est pas encore disponible.</p>
        <label class="mt-3 block text-sm font-medium">Archive ZIP V2
          <input class="mt-1 block w-full text-sm" type="file" accept=".zip,application/zip" (change)="previewFile($event)" />
        </label>
        @if (preview()) {
          <div class="mt-3 rounded-lg bg-slate-50 p-3 text-sm" role="status">
            <p class="break-all font-semibold">{{ preview()!.groupName }} · {{ preview()!.groupId }}</p>
            <p>{{ preview()!.counts.members }} membres · {{ preview()!.counts.expenses }} dépenses · {{ preview()!.counts.settlements }} remboursements · {{ preview()!.counts.fxSettlements }} remboursements multidevises</p>
            <p>{{ preview()!.counts.privateReceiptFiles }} reçus privés vérifiés · export du {{ preview()!.exportedAt }}</p>
            <p class="mt-1 text-amber-800">Archive partielle : comptes, préférences, commentaires et activité absents. Aucune restauration effectuée.</p>
          </div>
        }
        @if (previewMessage()) { <p class="mt-2 text-sm text-rose-700" role="status">{{ previewMessage() }}</p> }
      </div>
    </section>
  `,
})
export class ExportPanel {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;

  readonly busy = signal(false);
  readonly message = signal('');
  readonly preview = signal<BackupRestorePreviewV2 | undefined>(undefined);
  readonly previewMessage = signal('');
  groupId = '';
  kind: ExportKind = 'csv';
  private previewRequestId = 0;

  async previewFile(event: Event): Promise<void> {
    const requestId = ++this.previewRequestId;
    this.preview.set(undefined); this.previewMessage.set('');
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 60_000_000) { this.previewMessage.set('Archive trop volumineuse.'); return; }
    try {
      const result = await previewBackupRestoreV2(new Uint8Array(await file.arrayBuffer()));
      if (requestId === this.previewRequestId) this.preview.set(result);
    } catch { if (requestId === this.previewRequestId) this.previewMessage.set('Archive V2 invalide ou incomplète.'); }
  }

  async download(): Promise<void> {
    const user = this.user;
    const app = this.firebaseApp;
    const groupId = this.groupId;
    const kind = this.kind;
    if (this.busy() || !user?.emailVerified || !app || !this.groups.some(group => group.id === groupId)) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const reader = new FirebaseExportReader(app);
      let bytes: Uint8Array;
      let extension: string;
      let contentType: string;
      if (kind === 'zip' || kind === 'zip-v2') {
        if (!this.workerUrl) throw new Error('Worker indisponible');
        bytes = kind === 'zip-v2' ? await encodeBackupZipV2(await buildBackupPackageV2(reader, user, groupId, this.workerUrl)) :
          await encodeBackupZipV1(await buildBackupPackageV1(reader, user, groupId, this.workerUrl));
        extension = 'zip'; contentType = 'application/zip';
      } else {
        const json = kind === 'json-v2' ? await collectGroupExportV2(reader, user, groupId) : await collectGroupExportV1(reader, user, groupId);
        const content = kind === 'csv' ? serializeGroupLedgerCsvV1(JSON.parse(json) as GroupExportV1) : json;
        bytes = new TextEncoder().encode(content);
        extension = kind === 'csv' ? 'csv' : 'json'; contentType = kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
      }
      if (this.groupId !== groupId || this.user?.uid !== user.uid) throw new Error('Sélection modifiée');
      // A fresh, owned ArrayBuffer avoids exposing a subarray or unsafe BlobPart type.
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: contentType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ourfinance-${groupId}-${kind.endsWith('-v2') ? 'v2-' : ''}partiel-${new Date().toISOString().slice(0, 10)}.${extension}`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message.set('Export partiel préparé. Vérifiez le téléchargement dans votre navigateur.');
    } catch {
      this.message.set('Export impossible. Vérifiez votre accès au groupe et réessayez.');
    } finally { this.busy.set(false); }
  }
}
