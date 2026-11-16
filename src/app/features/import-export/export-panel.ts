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

type ExportKind = 'csv' | 'json' | 'zip';

@Component({
  selector: 'app-export-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Exporter un groupe">
      <h2 class="text-lg font-semibold">Exporter un groupe</h2>
      <p class="mt-2 text-sm text-slate-700">Ces exports sont partiels. Ils ne permettent pas encore de restaurer le groupe : comptes, préférences, commentaires et activité sont absents.</p>
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
            <option value="zip">ZIP du groupe avec reçus privés, partiel</option>
          </select>
        </label>
        @if (kind === 'zip') { <p class="text-sm text-amber-800">Le ZIP contient des reçus privés. Conservez le fichier dans un emplacement sûr.</p> }
        <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="button"
          [disabled]="busy() || !groupId || !user?.emailVerified" (click)="download()">
          {{ busy() ? 'Préparation…' : 'Télécharger l’export' }}
        </button>
        @if (message()) { <p class="text-sm" role="status">{{ message() }}</p> }
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
  groupId = '';
  kind: ExportKind = 'csv';

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
      if (kind === 'zip') {
        if (!this.workerUrl) throw new Error('Worker indisponible');
        const backup = await buildBackupPackageV1(reader, user, groupId, this.workerUrl);
        bytes = await encodeBackupZipV1(backup);
        extension = 'zip'; contentType = 'application/zip';
      } else {
        const json = await collectGroupExportV1(reader, user, groupId);
        const content = kind === 'csv' ? serializeGroupLedgerCsvV1(JSON.parse(json) as GroupExportV1) : json;
        bytes = new TextEncoder().encode(content);
        extension = kind; contentType = kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
      }
      if (this.groupId !== groupId || this.user?.uid !== user.uid) throw new Error('Sélection modifiée');
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
      this.message.set('Export partiel préparé. Vérifiez le téléchargement dans votre navigateur.');
    } catch {
      this.message.set('Export impossible. Vérifiez votre accès au groupe et réessayez.');
    } finally { this.busy.set(false); }
  }
}
