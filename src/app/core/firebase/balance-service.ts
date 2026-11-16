import type { FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { calculateBalances, type ExpenseLedgerEntry, type LedgerTotal, type SettlementLedgerEntry } from '../../shared/utils/ledger';

export class BalanceService {
  constructor(private readonly app: FirebaseApp) {}

  async load(groupId: string): Promise<{ totals: LedgerTotal[]; incompleteCount: number }> {
    const db = getFirestore(this.app);
    const [expenseDocs, settlementDocs] = await Promise.all([
      getDocs(collection(db, 'groups', groupId, 'expenses')),
      getDocs(collection(db, 'groups', groupId, 'settlements')),
    ]);
    let incompleteCount = 0;
    const expenses: ExpenseLedgerEntry[] = [];
    for (const item of expenseDocs.docs) {
      const data = item.data();
      if (data['deleted'] === true) continue;
      if (!Array.isArray(data['payments']) || !Array.isArray(data['allocations'])) { incompleteCount++; continue; }
      expenses.push({ groupId, currency: String(data['currency']), date: String(data['date']), amountMinor: Number(data['amountMinor']), payments: data['payments'], allocations: data['allocations'] });
    }
    const settlements: SettlementLedgerEntry[] = settlementDocs.docs.filter(item => item.data()['deleted'] !== true).map(item => {
      const data = item.data();
      return { groupId, currency: String(data['currency']), date: String(data['date']), amountMinor: Number(data['amountMinor']), fromUserId: String(data['fromUserId']), toUserId: String(data['toUserId']) };
    });
    return { totals: calculateBalances(expenses, settlements), incompleteCount };
  }
}
