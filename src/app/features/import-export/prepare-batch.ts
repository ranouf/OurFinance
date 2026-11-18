import type { ImportPreviewV1 } from './import-v1';
import { reconcileNativeSplitwiseCsv, type NativeSplitwiseCsv } from './splitwise-native-csv';

interface ImportRecordBase {
  readonly sourceId: string;
  readonly date: string;
  readonly description: string;
  readonly currency: string;
}
type PreparedImportRecord = ImportRecordBase & ({
  readonly amountMinor: number;
  readonly netImpactsMinor: Readonly<Record<string, number>>;
} | {
  readonly sourceCostExact: string;
  readonly sourcePrecision: number;
  readonly netImpactsExact: Readonly<Record<string, string>>;
  readonly sourceCategory: string;
  readonly sourceOccurrence: number;
});

export interface PreparedImportBatch {
  readonly groupId: string;
  readonly body: {
    readonly batchId: string;
    readonly records: readonly PreparedImportRecord[];
  };
}

/** Keep only records not already present after a partially completed native import. */
export function pendingNativeImportBatches(batches: readonly PreparedImportBatch[], existingSourceIds: ReadonlySet<string>, undoneSourceIds: ReadonlySet<string> = new Set()): {
  readonly pending: PreparedImportBatch[];
  readonly alreadyImported: number;
  readonly alreadyUndone: number;
} {
  let alreadyImported = 0;
  let alreadyUndone = 0;
  const pending = batches.map(batch => ({ ...batch, body: { ...batch.body, records: batch.body.records.filter(record => {
    if (!existingSourceIds.has(record.sourceId)) return true;
    if (undoneSourceIds.has(record.sourceId)) alreadyUndone++;
    else alreadyImported++;
    return false;
  }) } })).filter(batch => batch.body.records.length > 0);
  return { pending, alreadyImported, alreadyUndone };
}

const documentId = /^[A-Za-z0-9_-]{1,128}$/;

function canonicalDecimal(value: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  const normalized = `${BigInt(whole)}${trimmedFraction ? `.${trimmedFraction}` : ''}`;
  return normalized === '0' ? '0' : `${negative ? '-' : ''}${normalized}`;
}
const batchIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/** Fail closed: incomplete previews and ambiguous account mapping never reach the Worker. */
export function prepareImportBatch(
  preview: ImportPreviewV1,
  sourceGroupId: string,
  targetGroupId: string,
  targetCurrency: string,
  memberMapping: Readonly<Record<string, string>>,
  batchId: string,
): PreparedImportBatch {
  if (preview.version !== 1 || preview.errors.length || preview.duplicateIds.length ||
      !documentId.test(sourceGroupId) || !documentId.test(targetGroupId) || !batchIdPattern.test(batchId) ||
      preview.records.length < 1 || preview.records.length > 10 ||
      preview.records.some(record => record.groupId !== sourceGroupId)) throw new Error('Aperçu incomplet ou groupe ambigu');
  if (!Intl.supportedValuesOf('currency').includes(targetCurrency)) throw new Error('Devise du groupe cible invalide');
  const incompatible = [...new Set(preview.records.filter(record => record.currency !== targetCurrency).map(record => record.currency))];
  if (incompatible.length) throw new Error(`Devise incompatible avec le groupe cible (${targetCurrency}) : ${incompatible.join(', ')}. Choisir un groupe de la bonne devise ou exclure ces lignes.`);

  const mappedIds = Object.values(memberMapping);
  if (!mappedIds.length || mappedIds.some(id => !documentId.test(id)) || new Set(mappedIds).size !== mappedIds.length) {
    throw new Error('Correspondance des membres invalide ou ambiguë');
  }
  const records = preview.records.map(record => {
    const impacts = record.netImpactsMinor;
    if (!impacts || !Object.keys(impacts).length) throw new Error('Impacts historiques manquants');
    const mappedEntries: [string, number][] = [];
    for (const [sourceUserId, amount] of Object.entries(impacts)) {
      const targetUserId = Object.hasOwn(memberMapping, sourceUserId) ? memberMapping[sourceUserId] : undefined;
      if (!targetUserId || !Number.isSafeInteger(amount)) throw new Error('Membre ou impact invalide');
      mappedEntries.push([targetUserId, amount]);
    }
    const mapped = Object.fromEntries(mappedEntries) as Record<string, number>;
    if (Object.values(mapped).reduce((sum, amount) => sum + BigInt(amount), 0n) !== 0n) {
      throw new Error('Impacts historiques non équilibrés');
    }
    return {
      sourceId: record.sourceId,
      date: record.date,
      description: record.description,
      currency: record.currency,
      amountMinor: record.amountMinor,
      netImpactsMinor: mapped,
    };
  });
  return { groupId: targetGroupId, body: { batchId, records } };
}

/** Creates idempotent, source-precise batches without inferring historical shares. */
export async function prepareNativeImportBatches(
  source: NativeSplitwiseCsv,
  sourceGroupId: string,
  targetGroupId: string,
  targetCurrency: string,
  memberMapping: Readonly<Record<string, string>>,
): Promise<PreparedImportBatch[]> {
  if (!documentId.test(sourceGroupId) || !documentId.test(targetGroupId) || source.currency !== targetCurrency ||
      !reconcileNativeSplitwiseCsv(source).matched) throw new Error('Source non rapprochée ou devise incompatible');
  const memberIds = source.participants.map(person => memberMapping[person]);
  if (memberIds.some(id => !id || !documentId.test(id)) || new Set(memberIds).size !== memberIds.length) throw new Error('Correspondance des membres invalide');
  const occurrences = new Map<string, number>();
  const records: PreparedImportRecord[] = [];
  for (const row of source.rows) {
    if (row.description.length > 160 || row.category.length > 120) throw new Error('Libellé historique trop long');
    const canonical = [row.date, row.description.trim(), row.category.trim(), row.currency, canonicalDecimal(row.cost)] as const;
    const signature = JSON.stringify(canonical);
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    const bytes = new TextEncoder().encode(JSON.stringify([...canonical, occurrence]));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const sourceId = `native_${[...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
    const sourcePrecision = Math.max((row.cost.split('.')[1] ?? '').length,
      ...source.participants.map(person => (row.impacts[person].split('.')[1] ?? '').length));
    records.push({ sourceId, date: row.date, description: row.description, currency: row.currency,
      sourceCostExact: row.cost, sourcePrecision,
      sourceCategory: row.category, sourceOccurrence: occurrence,
      netImpactsExact: Object.fromEntries(source.participants.map(person => [memberMapping[person], row.impacts[person]])) });
  }
  const batches: PreparedImportBatch[] = [];
  for (let index = 0; index < records.length; index += 10) {
    batches.push({ groupId: targetGroupId, body: { batchId: crypto.randomUUID(), records: records.slice(index, index + 10) } });
  }
  return batches;
}
