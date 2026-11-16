import { parseCsv } from './csv';

export interface ImportRecordV1 {
  readonly sourceId: string;
  readonly groupId: string;
  readonly date: string;
  readonly description: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly splitStatus: 'undetermined';
}
export interface ImportPreviewV1 {
  readonly version: 1;
  readonly records: readonly ImportRecordV1[];
  readonly duplicateIds: readonly string[];
  readonly errors: readonly string[];
}

/** Explicit mapping is required because Splitwise CSV layouts can differ. */
export function previewMappedCsv(csv: string, mapping: Record<'sourceId' | 'groupId' | 'date' | 'description' | 'amountMinor' | 'currency', string>, existingIds: ReadonlySet<string>): ImportPreviewV1 {
  const [headers, ...rows] = parseCsv(csv);
  if (!headers) throw new Error('CSV vide');
  const index = Object.fromEntries(Object.entries(mapping).map(([key, header]) => [key, headers.indexOf(header)]));
  if (Object.values(index).some(value => value < 0)) throw new Error('Colonne manquante');
  const records: ImportRecordV1[] = [], duplicateIds: string[] = [], errors: string[] = [];
  const seen = new Set(existingIds);
  rows.forEach((row, position) => {
    const read = (key: keyof typeof index) => row[index[key]]?.trim() ?? '';
    const sourceId = read('sourceId');
    if (!sourceId || !read('groupId') || !/^\d{4}-\d{2}-\d{2}$/.test(read('date')) || !read('currency') || !Number.isSafeInteger(Number(read('amountMinor'))) || Number(read('amountMinor')) < 0) {
      errors.push(`Ligne ${position + 2} : champs requis ou montant invalide`); return;
    }
    const provenanceKey = JSON.stringify([read('groupId'), sourceId]);
    if (seen.has(provenanceKey)) { duplicateIds.push(sourceId); return; }
    seen.add(provenanceKey);
    records.push({ sourceId, groupId: read('groupId'), date: read('date'), description: read('description'), amountMinor: Number(read('amountMinor')), currency: read('currency'), splitStatus: 'undetermined' });
  });
  return { version: 1, records, duplicateIds, errors };
}
