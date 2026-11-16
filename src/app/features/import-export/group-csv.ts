import { validateGroupExportV1, type GroupExportV1 } from './export-v1';

type CsvRow = readonly [string, string, string, string, string, number, string, number, number, number, string, string, string, string];

const header = [
  'Type', 'ID', 'Date', 'Description', 'Devise', 'Montant mineur', 'Membre ID',
  'Payé mineur', 'Dû mineur', 'Impact net mineur', 'Répartition', 'Statut',
  'Catégorie ID', 'Catégorie',
];

/** Quotes CSV cells and neutralizes spreadsheet formulas in text fields. */
const cell = (value: string | number): string => {
  const raw = String(value);
  const safe = typeof value === 'string' && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

const add = (map: Map<string, number>, userId: string, amount: number) => {
  const result = BigInt(map.get(userId) ?? 0) + BigInt(amount);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Total CSV hors plage');
  map.set(userId, Number(result));
};
const difference = (left: number, right: number): number => {
  const result = BigInt(left) - BigInt(right);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Impact CSV hors plage');
  return Number(result);
};

/** A human-readable ledger report, not a restorable backup. */
export function serializeGroupLedgerCsvV1(group: GroupExportV1): string {
  validateGroupExportV1(group);
  const rows: CsvRow[] = [];
  for (const expense of group.expenses) {
    const paid = new Map<string, number>();
    const owed = new Map<string, number>();
    for (const entry of expense.payments) add(paid, entry.userId, entry.amountMinor);
    for (const entry of expense.allocations) add(owed, entry.userId, entry.amountMinor);
    for (const userId of new Set([...paid.keys(), ...owed.keys()])) {
      const paidMinor = paid.get(userId) ?? 0;
      const owedMinor = owed.get(userId) ?? 0;
      rows.push(['expense', expense.id, expense.date, expense.description, expense.currency, expense.amountMinor,
        userId, paidMinor, owedMinor, difference(paidMinor, owedMinor), 'determined', expense.deleted ? 'deleted' : 'active',
        expense.categoryId, expense.categoryLabel]);
    }
  }
  for (const settlement of group.settlements) {
    const status = settlement.deleted ? 'deleted' : settlement.status;
    rows.push(['settlement', settlement.id, settlement.date, '', settlement.currency, settlement.amountMinor,
      settlement.fromUserId, 0, 0, settlement.amountMinor, '', status, '', '']);
    rows.push(['settlement', settlement.id, settlement.date, '', settlement.currency, settlement.amountMinor,
      settlement.toUserId, 0, 0, -settlement.amountMinor, '', status, '', '']);
  }
  for (const imported of group.importedRecords) {
    for (const [userId, impact] of Object.entries(imported.netImpactsMinor)) {
      rows.push(['import', imported.id, imported.date, imported.description, imported.currency, imported.amountMinor,
        userId, 0, 0, impact, 'undetermined', imported.status, '', '']);
    }
  }
  rows.sort((left, right) => left[2].localeCompare(right[2]) || left[0].localeCompare(right[0]) ||
    left[1].localeCompare(right[1]) || left[6].localeCompare(right[6]));
  const output = `\uFEFF${[header, ...rows].map(row => row.map(cell).join(',')).join('\r\n')}\r\n`;
  if (new TextEncoder().encode(output).byteLength > 10_000_000) throw new Error('CSV trop volumineux');
  return output;
}
