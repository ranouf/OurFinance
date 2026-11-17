import { Component, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore, limit, query, where } from 'firebase/firestore';
import { ExpenseService } from '../../core/firebase/expense-service';
import type { Group, GroupMember } from '../../core/firebase/group-model';
import { formatMinorExact } from '../../shared/utils/currency';
import { locale, t } from '../../shared/utils/i18n';
import { parseMinor } from '../expenses/expense-draft';
import { parseCsv } from './csv';
import { FirebaseExportReader } from './export-collector';
import { previewMappedCsv, type ImportPreviewV1, type ImportRecordV1 } from './import-v1';
import { ImportService } from './import-service';
import { importText, type ImportTextKey } from './import-text';
import { prepareImportBatch } from './prepare-batch';
import { reconcileImpacts, type Reconciliation } from './reconcile';

type ColumnKey = 'sourceId' | 'groupId' | 'date' | 'description' | 'amountMinor' | 'currency';
interface ActiveBatch { readonly id: string; readonly recordCount: number; }

@Component({
  selector: 'app-import-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="text('title')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ text('title') }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ text('intro') }}</p>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <label class="block text-sm font-bold">{{ text('target') }}
          <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="importGroup" [(ngModel)]="groupId" (ngModelChange)="loadGroup()">
            <option value="">{{ t('chooseGroup') }}</option>
            @for (group of ownedGroups(); track group.id) { <option [value]="group.id">{{ group.name }} · {{ group.currency }}</option> }
          </select>
        </label>
        <label class="block text-sm font-bold">{{ text('file') }}
          <input class="mt-2 block min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-pop-lavender file:px-3 file:py-2 file:font-bold file:text-pop-primary-dark" type="file" accept=".csv,text/csv" (change)="loadFile($event)" />
        </label>
      </div>
      @if (!ownedGroups().length) { <p class="mt-4 rounded-xl bg-pop-peach p-3 text-sm">{{ text('ownerOnly') }}</p> }
      @if (headers().length && groupId) {
        <div class="mt-6 rounded-2xl bg-pop-lavender p-4 sm:p-5">
          <h3 class="font-extrabold">{{ text('columns') }}</h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            @for (field of fields; track field.key) {
              <label class="block text-sm font-bold">{{ text(field.label) }}
                <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3" [name]="'import_' + field.key" [(ngModel)]="mapping[field.key]" (ngModelChange)="clearPreview()">
                  <option value="">{{ text('chooseColumn') }}</option>
                  @for (header of headers(); track header) { <option [value]="header">{{ header }}</option> }
                </select>
              </label>
            }
          </div>
          <h3 class="mt-6 font-extrabold">{{ text('impacts') }}</h3>
          <p class="mt-1 text-sm text-pop-muted">{{ text('expectedHint') }}</p>
          <div class="mt-3 grid gap-3 lg:grid-cols-2">
            @for (header of impactCandidates(); track header) {
              <div class="rounded-xl border border-pop-border bg-pop-surface p-3">
                <label class="flex min-h-11 items-center gap-2 text-sm font-bold">
                  <input type="checkbox" [checked]="impactHeaders().includes(header)" (change)="toggleImpact(header, $event)" /> {{ text('useImpact') }} · {{ header }}
                </label>
                @if (impactHeaders().includes(header)) {
                  <label class="mt-2 block text-sm">{{ text('targetMember') }}
                    <select class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-2" [name]="'member_' + header" [(ngModel)]="memberMapping[header]" (ngModelChange)="recompute()">
                      <option value="">{{ text('chooseColumn') }}</option>
                      @for (member of members(); track member.userId) { <option [value]="member.userId">{{ memberLabel(member.userId) }}</option> }
                    </select>
                  </label>
                  <label class="mt-2 block text-sm">{{ text('expected') }} · {{ selectedGroup()?.currency }}
                    <input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-2" [name]="'expected_' + header" inputmode="decimal" [(ngModel)]="expected[header]" (ngModelChange)="recompute()" placeholder="0.00" />
                  </label>
                }
              </div>
            }
          </div>
          <button class="mt-5 min-h-11 rounded-xl bg-pop-primary px-5 py-2 font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="preparePreview()">{{ text('preview') }}</button>
        </div>
      }
      @if (preview(); as result) {
        <div class="mt-6 rounded-2xl border border-pop-border p-4 sm:p-5">
          <h3 class="text-lg font-extrabold">{{ text('previewTitle') }}</h3>
          <label class="mt-4 block text-sm font-bold">{{ text('sourceGroup') }}
            <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border p-3" name="sourceGroup" [(ngModel)]="sourceGroupId" (ngModelChange)="recompute()">
              @for (source of sourceGroups(); track source) { <option [value]="source">{{ source }}</option> }
            </select>
          </label>
          <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p class="rounded-xl bg-pop-lavender p-3"><strong>{{ compatibleRecords().length }}</strong> {{ text('records') }}</p>
            <p class="rounded-xl bg-pop-peach p-3"><strong>{{ result.duplicateIds.length }}</strong> {{ text('duplicates') }}</p>
            <p class="rounded-xl bg-pop-peach p-3"><strong>{{ result.errors.length }}</strong> {{ text('errors') }}</p>
            <p class="rounded-xl bg-pop-mint-soft p-3"><strong>{{ foreignCount() }}</strong> {{ text('foreign') }}</p>
          </div>
          @if (otherGroupCount()) { <p class="mt-3 text-sm text-pop-muted">{{ otherGroupCount() }} {{ text('otherGroups') }}</p> }
          @if (foreignCount()) {
            <label class="mt-4 flex min-h-11 items-start gap-3 rounded-xl bg-pop-peach p-3 text-sm"><input class="mt-1" type="checkbox" [(ngModel)]="excludeForeign" />{{ text('acknowledgeForeign') }}</label>
          }
          @if (result.errors.length || result.duplicateIds.length) {
            <ul class="mt-4 list-inside list-disc text-sm text-rose-700">
              @for (error of result.errors; track $index) { <li>{{ error }}</li> }
              @for (id of result.duplicateIds; track $index) { <li>{{ text('duplicates') }} : {{ id }}</li> }
            </ul>
          }
          <ul class="mt-4 space-y-2">
            @for (record of compatibleRecords(); track record.sourceId) {
              <li class="flex justify-between gap-3 rounded-xl border border-pop-border p-3 text-sm"><span class="min-w-0 break-words">{{ record.date }} · {{ record.description }}</span><strong class="shrink-0">{{ amount(record.amountMinor) }}</strong></li>
            }
          </ul>
          @if (reconciliation(); as match) {
            <div class="mt-5 rounded-xl bg-pop-lavender p-3 text-sm">
              <p class="font-bold">{{ text(match.matched ? 'matched' : 'mismatch') }}</p>
              @for (row of match.differences; track row.userId) {
                <p class="mt-2 flex flex-wrap justify-between gap-2"><span>{{ row.userId }}</span><span>{{ text('imported') }} {{ minor(row.importedMinor) }} · {{ text('expected') }} {{ minor(row.expectedMinor) }} · {{ text('difference') }} {{ minor(row.differenceMinor) }}</span></p>
              }
            </div>
          }
          <button class="mt-5 min-h-11 rounded-xl bg-pop-primary px-5 py-2 font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="button" [disabled]="!canImport()" (click)="save()">{{ busy() ? text('importing') : text('import') }}</button>
        </div>
      }
      @if (batches().length) {
        <div class="mt-6 rounded-2xl border border-pop-border p-4 sm:p-5">
          <h3 class="font-extrabold">{{ text('batches') }}</h3>
          <ul class="mt-3 space-y-2">
            @for (batch of batches(); track batch.id) {
              <li class="rounded-xl bg-pop-lavender p-3 text-sm">
                <p class="font-bold">{{ text('batch') }} {{ batch.id.slice(0, 8) }} · {{ batch.recordCount }} {{ text('records') }}</p>
                @if (undoConfirmId() === batch.id) {
                  <div class="mt-2 flex flex-wrap gap-2"><button class="min-h-11 rounded-xl bg-pop-coral px-4 font-bold text-pop-text" type="button" [disabled]="busy()" (click)="undo(batch.id)">{{ text('confirmUndo') }}</button><button class="min-h-11 rounded-xl border border-pop-border px-4" type="button" (click)="undoConfirmId.set('')">{{ text('cancel') }}</button></div>
                } @else { <button class="mt-2 min-h-11 rounded-xl border border-pop-primary px-4 font-bold text-pop-primary-dark" type="button" (click)="undoConfirmId.set(batch.id)">{{ text('undo') }}</button> }
              </li>
            }
          </ul>
        </div>
      }
      @if (message()) { <p class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm" role="status">{{ displayMessage() }}</p> }
    </section>
  `,
})
export class ImportPanel {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  readonly t = t;
  readonly text = importText;
  readonly fields: readonly { key: ColumnKey; label: ImportTextKey }[] = [
    { key: 'sourceId', label: 'sourceId' }, { key: 'groupId', label: 'groupId' }, { key: 'date', label: 'date' },
    { key: 'description', label: 'description' }, { key: 'amountMinor', label: 'amountMinor' }, { key: 'currency', label: 'currency' },
  ];
  readonly headers = signal<string[]>([]);
  readonly members = signal<GroupMember[]>([]);
  readonly preview = signal<ImportPreviewV1 | null>(null);
  readonly reconciliation = signal<Reconciliation | null>(null);
  readonly batches = signal<ActiveBatch[]>([]);
  readonly impactHeaders = signal<string[]>([]);
  readonly busy = signal(false);
  readonly message = signal<string>('');
  readonly undoConfirmId = signal('');
  mapping: Record<ColumnKey, string> = { sourceId: '', groupId: '', date: '', description: '', amountMinor: '', currency: '' };
  memberMapping: Record<string, string> = {};
  expected: Record<string, string> = {};
  groupId = '';
  sourceGroupId = '';
  excludeForeign = false;
  private csv = '';
  private existingSourceIds = new Set<string>();

  ownedGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid); }
  selectedGroup(): Group | undefined { return this.groups.find(group => group.id === this.groupId); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? t('me') : `${t('otherMember')} ${userId.slice(0, 8)}`; }
  impactCandidates(): string[] { return this.headers().filter(header => !Object.values(this.mapping).includes(header)); }
  sourceGroups(): string[] { return [...new Set(this.preview()?.records.map(record => record.groupId) ?? [])].sort(); }
  compatibleRecords(): ImportRecordV1[] { return this.preview()?.records.filter(record => record.groupId === this.sourceGroupId && record.currency === this.selectedGroup()?.currency) ?? []; }
  foreignCount(): number { return this.preview()?.records.filter(record => record.groupId === this.sourceGroupId && record.currency !== this.selectedGroup()?.currency).length ?? 0; }
  otherGroupCount(): number { return this.preview()?.records.filter(record => record.groupId !== this.sourceGroupId).length ?? 0; }
  amount(value: number): string { return formatMinorExact(BigInt(value), this.selectedGroup()?.currency ?? 'CAD', locale()); }
  minor(value: string): string { return formatMinorExact(BigInt(value), this.selectedGroup()?.currency ?? 'CAD', locale()); }
  displayMessage(): string { return this.message() in { importedOk: true, importFailed: true, undone: true, undoFailed: true, unavailable: true } ? this.text(this.message() as ImportTextKey) : this.message(); }
  clearPreview(): void { this.preview.set(null); this.reconciliation.set(null); this.impactHeaders.set(this.impactHeaders().filter(header => this.impactCandidates().includes(header))); }

  async loadFile(event: Event): Promise<void> {
    this.clearPreview(); this.headers.set([]); this.csv = ''; this.message.set('');
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { this.message.set(this.text('fileTooLarge')); return; }
    try {
      this.csv = await file.text();
      const headers = parseCsv(this.csv)[0];
      if (!headers?.length || new Set(headers).size !== headers.length) throw new Error(this.text('mappingMissing'));
      this.headers.set(headers);
      const defaults: Record<ColumnKey, string> = { sourceId: 'Source ID', groupId: 'Group ID', date: 'Date', description: 'Description', amountMinor: 'Amount Minor', currency: 'Currency' };
      for (const key of Object.keys(defaults) as ColumnKey[]) this.mapping[key] = headers.find(header => header.toLowerCase() === defaults[key].toLowerCase()) ?? '';
    } catch (error) { this.message.set(error instanceof Error ? error.message : this.text('fileMissing')); }
  }

  async loadGroup(): Promise<void> {
    this.clearPreview(); this.members.set([]); this.batches.set([]); this.existingSourceIds.clear(); this.message.set('');
    const groupId = this.groupId;
    if (!this.selectedGroup() || !this.firebaseApp || !this.user || !this.workerUrl) return;
    this.busy.set(true);
    try {
      const [members, imported] = await Promise.all([
        new ExpenseService(this.firebaseApp, this.workerUrl).members(groupId),
        new FirebaseExportReader(this.firebaseApp).list(`groups/${groupId}/importedRecords`),
      ]);
      if (this.groupId !== groupId) return;
      this.members.set(members.filter(member => member.status === 'active'));
      this.existingSourceIds = new Set(imported.map(record => String(record.data['sourceId'])));
      await this.refreshBatches();
    } catch { this.message.set('unavailable'); }
    finally { this.busy.set(false); }
  }

  toggleImpact(header: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.impactHeaders.update(values => checked ? [...values, header] : values.filter(value => value !== header));
    this.clearPreview();
  }

  preparePreview(): void {
    this.clearPreview(); this.message.set('');
    if (!this.csv) { this.message.set(this.text('fileMissing')); return; }
    if (Object.values(this.mapping).some(value => !value) || new Set(Object.values(this.mapping)).size !== this.fields.length || this.impactHeaders().length < 2) { this.message.set(this.text('mappingMissing')); return; }
    try {
      const rows = parseCsv(this.csv);
      const groupColumn = rows[0].indexOf(this.mapping.groupId);
      const groups = new Set(rows.slice(1).map(row => row[groupColumn]).filter(Boolean));
      const existing = new Set([...groups].flatMap(group => [...this.existingSourceIds].map(id => JSON.stringify([group, id]))));
      const impacts = Object.fromEntries(this.impactHeaders().map(header => [header, header]));
      const result = previewMappedCsv(this.csv, this.mapping, existing, impacts);
      this.preview.set(result);
      this.sourceGroupId = this.sourceGroups()[0] ?? '';
      this.excludeForeign = false;
      this.recompute();
    } catch (error) { this.message.set(error instanceof Error ? error.message : this.text('unavailable')); }
  }

  recompute(): void {
    this.reconciliation.set(null);
    if (!this.preview() || !this.sourceGroupId || this.impactHeaders().some(header => !this.expected[header]?.trim())) return;
    try {
      const expected = this.impactHeaders().map(header => ({ groupId: this.sourceGroupId, currency: this.selectedGroup()!.currency, userId: header, balanceMinor: String(parseMinor(this.expected[header], this.selectedGroup()!.currency, true)) }));
      this.reconciliation.set(reconcileImpacts(this.compatibleRecords(), expected));
    } catch { this.message.set(this.text('missingExpected')); }
  }

  canImport(): boolean {
    const ids = this.impactHeaders().map(header => this.memberMapping[header]);
    return !this.busy() && !!this.user?.emailVerified && this.selectedGroup()?.ownerId === this.user?.uid &&
      !!this.preview() && !this.preview()!.errors.length && !this.preview()!.duplicateIds.length &&
      this.compatibleRecords().length > 0 && (!this.foreignCount() || this.excludeForeign) && !!this.reconciliation()?.matched &&
      ids.length >= 2 && ids.every(id => this.members().some(member => member.userId === id)) && new Set(ids).size === ids.length;
  }

  async save(): Promise<void> {
    if (!this.canImport() || !this.user || !this.workerUrl) return;
    const records = this.compatibleRecords();
    const group = this.selectedGroup()!;
    const mapping = Object.fromEntries(this.impactHeaders().map(header => [header, this.memberMapping[header]]));
    this.busy.set(true); this.message.set('');
    try {
      const service = new ImportService(this.workerUrl);
      for (let index = 0; index < records.length; index += 10) {
        const preview: ImportPreviewV1 = { version: 1, records: records.slice(index, index + 10), duplicateIds: [], errors: [] };
        const batch = prepareImportBatch(preview, this.sourceGroupId, group.id, group.currency, mapping, crypto.randomUUID());
        await service.create(this.user, batch);
        for (const record of preview.records) this.existingSourceIds.add(record.sourceId);
      }
      this.message.set('importedOk'); this.clearPreview(); await this.refreshBatches();
    } catch { this.message.set('importFailed'); await this.refreshBatches().catch(() => {}); }
    finally { this.busy.set(false); }
  }

  async undo(batchId: string): Promise<void> {
    if (!this.user || !this.workerUrl || !this.groupId || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await new ImportService(this.workerUrl).undo(this.user, this.groupId, batchId); this.message.set('undone'); this.undoConfirmId.set(''); await this.refreshBatches(); }
    catch { this.message.set('undoFailed'); }
    finally { this.busy.set(false); }
  }

  private async refreshBatches(): Promise<void> {
    if (!this.firebaseApp || !this.user || !this.groupId) return;
    const groupId = this.groupId;
    const source = collection(getFirestore(this.firebaseApp), 'users', this.user.uid, 'importBatches');
    const snapshot = await getDocs(query(source, where('groupId', '==', groupId), limit(100)));
    if (this.groupId !== groupId) return;
    this.batches.set(snapshot.docs.filter(doc => doc.data()['status'] === 'active').map(doc => ({ id: doc.id, recordCount: Array.isArray(doc.data()['recordIds']) ? doc.data()['recordIds'].length : 0 })));
  }
}
