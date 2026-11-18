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
import { importErrorText, importText, type ImportTextKey } from './import-text';
import { pendingNativeImportBatches, prepareImportBatch, prepareNativeImportBatches, type PreparedImportBatch } from './prepare-batch';
import { reconcileImpacts, type Reconciliation } from './reconcile';
import { parseNativeSplitwiseCsv, reconcileNativeSplitwiseCsv, type NativeSplitwiseCsv } from './splitwise-native-csv';

type ColumnKey = 'sourceId' | 'groupId' | 'date' | 'description' | 'amountMinor' | 'currency';
interface ActiveBatch { readonly id: string; readonly recordCount: number; }

@Component({
  selector: 'app-import-panel',
  imports: [FormsModule],
  templateUrl: './import-panel.html',
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
  readonly nativeSource = signal<NativeSplitwiseCsv | null>(null);
  readonly nativeBatches = signal<PreparedImportBatch[]>([]);
  readonly nativeAlreadyImported = signal(0);
  readonly nativeAlreadyUndone = signal(0);
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
  private undoneSourceIds = new Set<string>();
  private nativePreviewRequest = 0;

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
  displayMessage(): string { return this.message() === 'invalidFile' ? importErrorText('file') : this.text(this.message() as ImportTextKey); }
  rowError(error: string): string {
    const row = /^Ligne (\d+) :/.exec(error);
    return row ? `${this.text('row')} ${row[1]} : ${importErrorText(error.includes('impacts') ? 'impacts' : 'row')}` : importErrorText('file');
  }
  clearPreview(): void { this.nativePreviewRequest++; this.preview.set(null); this.reconciliation.set(null); this.nativeBatches.set([]); this.nativeAlreadyImported.set(0); this.nativeAlreadyUndone.set(0); this.impactHeaders.set(this.impactHeaders().filter(header => this.impactCandidates().includes(header))); }

  async loadFile(event: Event): Promise<void> {
    this.clearPreview(); this.headers.set([]); this.nativeSource.set(null); this.csv = ''; this.message.set(''); this.sourceGroupId = '';
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { this.message.set('invalidFile'); return; }
    if (file.size > 10_000_000) { this.message.set('fileTooLarge'); return; }
    try {
      this.csv = await file.text();
      const rows = parseCsv(this.csv.replace(/^\uFEFF/, ''));
      if (rows.some(row => row[0]?.trim() === 'Date' && row[1]?.trim() === 'Description' && row[3]?.trim() === 'Coût')) {
        this.nativeSource.set(parseNativeSplitwiseCsv(this.csv));
        return;
      }
      const headers = rows[0];
      if (!headers?.length || new Set(headers).size !== headers.length) throw new Error(this.text('mappingMissing'));
      this.headers.set(headers);
      const defaults: Record<ColumnKey, string> = { sourceId: 'Source ID', groupId: 'Group ID', date: 'Date', description: 'Description', amountMinor: 'Amount Minor', currency: 'Currency' };
      for (const key of Object.keys(defaults) as ColumnKey[]) this.mapping[key] = headers.find(header => header.toLowerCase() === defaults[key].toLowerCase()) ?? '';
    } catch { this.message.set('invalidFile'); }
  }

  async loadGroup(): Promise<void> {
    this.clearPreview(); this.members.set([]); this.batches.set([]); this.existingSourceIds.clear(); this.undoneSourceIds.clear(); this.message.set('');
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
      this.undoneSourceIds = new Set(imported.filter(record => record.data['status'] === 'undone').map(record => String(record.data['sourceId'])));
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
    if (!this.csv) { this.message.set('fileMissing'); return; }
    if (Object.values(this.mapping).some(value => !value) || new Set(Object.values(this.mapping)).size !== this.fields.length || this.impactHeaders().length < 2) { this.message.set('mappingMissing'); return; }
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
    } catch { this.message.set('invalidFile'); }
  }

  recompute(): void {
    this.reconciliation.set(null);
    if (!this.preview() || !this.sourceGroupId || this.impactHeaders().some(header => !this.expected[header]?.trim())) return;
    try {
      const expected = this.impactHeaders().map(header => ({ groupId: this.sourceGroupId, currency: this.selectedGroup()!.currency, userId: header, balanceMinor: String(parseMinor(this.expected[header], this.selectedGroup()!.currency, true)) }));
      this.reconciliation.set(reconcileImpacts(this.compatibleRecords(), expected));
    } catch { this.message.set('missingExpected'); }
  }

  canImport(): boolean {
    if (this.nativeSource()) return !this.busy() && !!this.user?.emailVerified && this.selectedGroup()?.ownerId === this.user?.uid && this.nativeBatches().length > 0;
    const ids = this.impactHeaders().map(header => this.memberMapping[header]);
    return !this.busy() && !!this.user?.emailVerified && this.selectedGroup()?.ownerId === this.user?.uid &&
      !!this.preview() && !this.preview()!.errors.length && !this.preview()!.duplicateIds.length &&
      this.compatibleRecords().length > 0 && (!this.foreignCount() || this.excludeForeign) && !!this.reconciliation()?.matched &&
      ids.length >= 2 && ids.every(id => this.members().some(member => member.userId === id)) && new Set(ids).size === ids.length;
  }

  async save(): Promise<void> {
    if (!this.canImport() || !this.user || !this.workerUrl) return;
    if (this.nativeSource()) {
      this.busy.set(true); this.message.set('');
      try {
        const service = new ImportService(this.workerUrl);
        for (const batch of this.nativeBatches()) {
          await service.create(this.user, batch);
          for (const record of batch.body.records) this.existingSourceIds.add(record.sourceId);
        }
        await this.refreshAfterImport();
      } catch { await this.loadGroup(); if (this.message() !== 'unavailable') this.message.set('importFailed'); }
      finally { this.busy.set(false); }
      return;
    }
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
      await this.refreshAfterImport();
    } catch { this.message.set('importFailed'); await this.refreshBatches().catch(() => {}); }
    finally { this.busy.set(false); }
  }

  async prepareNativePreview(): Promise<void> {
    this.clearPreview(); this.message.set('');
    const request = this.nativePreviewRequest;
    const source = this.nativeSource();
    const group = this.selectedGroup();
    if (!source || !group) return;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(this.sourceGroupId.trim())) { this.message.set('nativeSourceGroupInvalid'); return; }
    if (!reconcileNativeSplitwiseCsv(source).matched) { this.message.set('mismatch'); return; }
    if (source.currency !== group.currency) { this.message.set('nativeCurrency'); return; }
    const ids = source.participants.map(person => this.memberMapping[person]);
    if (ids.some(id => !this.members().some(member => member.userId === id)) || new Set(ids).size !== ids.length) { this.message.set('memberMapping'); return; }
    this.busy.set(true);
    try {
      const mapping = Object.fromEntries(source.participants.map(person => [person, this.memberMapping[person]]));
      const batches = await prepareNativeImportBatches(source, this.sourceGroupId.trim(), group.id, group.currency, mapping);
      if (request !== this.nativePreviewRequest) return;
      const { pending, alreadyImported, alreadyUndone } = pendingNativeImportBatches(batches, this.existingSourceIds, this.undoneSourceIds);
      this.nativeAlreadyImported.set(alreadyImported);
      this.nativeAlreadyUndone.set(alreadyUndone);
      if (!pending.length) { this.message.set(alreadyUndone ? 'nativeReserved' : 'nativeAllImported'); return; }
      this.nativeBatches.set(pending);
    } catch { this.message.set('invalidFile'); }
    finally { this.busy.set(false); }
  }

  async undo(batchId: string): Promise<void> {
    if (!this.user || !this.workerUrl || !this.groupId || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await new ImportService(this.workerUrl).undo(this.user, this.groupId, batchId); this.undoConfirmId.set(''); await this.loadGroup(); if (this.message() !== 'unavailable') this.message.set('undone'); }
    catch { this.message.set('undoFailed'); }
    finally { this.busy.set(false); }
  }

  private async refreshAfterImport(): Promise<void> {
    this.clearPreview();
    try { await this.refreshBatches(); this.message.set('importedOk'); }
    catch { this.message.set('importedRefreshFailed'); }
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
