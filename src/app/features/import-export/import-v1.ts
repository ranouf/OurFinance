import { parseCsv } from './csv';
import { minorDigits } from '../../shared/utils/currency';

export interface ImportRecordV1 {
  readonly sourceId: string;
  readonly groupId: string;
  readonly date: string;
  readonly description: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly splitStatus: 'undetermined';
  /** Net impact from export, not an invented payment/allocation. */
  readonly netImpactsMinor?: Readonly<Record<string, number>>;
}
export interface ImportPreviewV1 {
  readonly version: 1;
  readonly records: readonly ImportRecordV1[];
  readonly duplicateIds: readonly string[];
  readonly errors: readonly string[];
}

/** Explicit mapping is required because Splitwise CSV layouts can differ. */
export function previewMappedCsv(csv: string, mapping: Record<'sourceId' | 'groupId' | 'date' | 'description' | 'amountMinor' | 'currency', string>, existingIds: ReadonlySet<string>, impactColumns?: Readonly<Record<string, string>>): ImportPreviewV1 {
  const [headers, ...rows] = parseCsv(csv);
  if (!headers) throw new Error('CSV vide');
  const index = Object.fromEntries(Object.entries(mapping).map(([key, header]) => [key, headers.indexOf(header)]));
  if (Object.values(index).some(value => value < 0)) throw new Error('Colonne manquante');
  const impactIndexes = impactColumns && Object.entries(impactColumns).map(([userId, header]) => [userId, headers.indexOf(header)] as const);
  if (impactIndexes?.some(([, column]) => column < 0)) throw new Error('Colonne de participant manquante');
  if (impactIndexes && (!impactIndexes.length || new Set(impactIndexes.map(([, column]) => column)).size !== impactIndexes.length)) throw new Error('Colonnes de participant dupliquées');
  const records: ImportRecordV1[] = [], duplicateIds: string[] = [], errors: string[] = [];
  const seen = new Set(existingIds);
  rows.forEach((row, position) => {
    const read = (key: keyof typeof index) => row[index[key]]?.trim() ?? '';
    const sourceId = read('sourceId');
    const date = read('date');
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    const amount = read('amountMinor');
    const currency = read('currency');
    if (row.length !== headers.length || !sourceId || !read('groupId') || !read('description') ||
        !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
        !Intl.supportedValuesOf('currency').includes(currency) || !/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) {
      errors.push(`Ligne ${position + 2} : champs requis ou montant invalide`); return;
    }
    const provenanceKey = JSON.stringify([read('groupId'), sourceId]);
    if (seen.has(provenanceKey)) { duplicateIds.push(sourceId); return; }
    let netImpactsMinor: Record<string, number> | undefined;
    if (impactIndexes) {
      try {
        const digits = minorDigits(read('currency'));
        netImpactsMinor = Object.fromEntries(impactIndexes.map(([userId, column]) => [userId, parseDecimalMinor(row[column]?.trim() ?? '', digits)]));
        if (Object.values(netImpactsMinor).reduce((sum, value) => sum + BigInt(value), 0n) !== 0n) throw new Error('Impacts non équilibrés');
      } catch { errors.push(`Ligne ${position + 2} : impacts invalides ou non équilibrés`); return; }
    }
    seen.add(provenanceKey);
    records.push({ sourceId, groupId: read('groupId'), date, description: read('description'), amountMinor: Number(amount), currency, splitStatus: 'undetermined', netImpactsMinor });
  });
  return { version: 1, records, duplicateIds, errors };
}

function parseDecimalMinor(value: string, digits: number): number {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[3]?.length ?? 0) > digits) throw new Error('Montant décimal invalide');
  const result = BigInt(match[2]) * 10n ** BigInt(digits) + BigInt((match[3] ?? '').padEnd(digits, '0') || '0');
  const signed = match[1] ? -result : result;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Montant hors limites');
  return Number(signed);
}
