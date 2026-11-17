import type { ImportRecordV1 } from './import-v1';

export interface ExpectedImpact {
  readonly groupId: string;
  readonly currency: string;
  readonly userId: string;
  /** Signed integer minor units from an independent source balance. */
  readonly balanceMinor: string;
}
export interface ImpactDifference extends Omit<ExpectedImpact, 'balanceMinor'> {
  readonly expectedMinor: string;
  readonly importedMinor: string;
  readonly differenceMinor: string;
}
export interface Reconciliation {
  readonly differences: readonly ImpactDifference[];
  readonly missingImpactRecords: number;
  readonly matched: boolean;
}

/** Compare net impacts without inferring unknown historical payers or shares. */
export function reconcileImpacts(records: readonly ImportRecordV1[], expected: readonly ExpectedImpact[]): Reconciliation {
  const key = (groupId: string, currency: string, userId: string) => JSON.stringify([groupId, currency, userId]);
  const totals = new Map<string, bigint>();
  const expectedTotals = new Map<string, bigint>();
  let missingImpactRecords = 0;
  for (const record of records) {
    if (!record.netImpactsMinor) { missingImpactRecords++; continue; }
    for (const [userId, amount] of Object.entries(record.netImpactsMinor)) {
      if (!Number.isSafeInteger(amount)) throw new Error('Impact non entier ou hors limites');
      const id = key(record.groupId, record.currency, userId);
      totals.set(id, (totals.get(id) ?? 0n) + BigInt(amount));
    }
  }
  for (const row of expected) {
    if (!/^-?\d+$/.test(row.balanceMinor)) throw new Error('Solde de référence invalide');
    const id = key(row.groupId, row.currency, row.userId);
    if (expectedTotals.has(id)) throw new Error('Solde de référence dupliqué');
    expectedTotals.set(id, BigInt(row.balanceMinor));
  }
  const ids = [...new Set([...totals.keys(), ...expectedTotals.keys()])].sort();
  const differences = ids.map(id => {
    const [groupId, currency, userId] = JSON.parse(id) as [string, string, string];
    const imported = totals.get(id) ?? 0n;
    const target = expectedTotals.get(id) ?? 0n;
    return { groupId, currency, userId, expectedMinor: String(target), importedMinor: String(imported), differenceMinor: String(imported - target) };
  });
  return { differences, missingImpactRecords, matched: missingImpactRecords === 0 && differences.every(row => row.differenceMinor === '0') };
}
