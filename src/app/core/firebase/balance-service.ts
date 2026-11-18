import type { FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore, type DocumentData, type QuerySnapshot } from 'firebase/firestore';
import { calculateBalances, type ExpenseLedgerEntry, type LedgerTotal, type SettlementLedgerEntry } from '../../shared/utils/ledger';

export interface BalanceRepository {
  expenses(app: FirebaseApp, groupId: string): Promise<QuerySnapshot<DocumentData>>;
  settlements(app: FirebaseApp, groupId: string): Promise<QuerySnapshot<DocumentData>>;
}

const firestoreBalanceRepository: BalanceRepository = {
  expenses: (app, groupId) => getDocs(collection(getFirestore(app), 'groups', groupId, 'expenses')),
  settlements: (app, groupId) => getDocs(collection(getFirestore(app), 'groups', groupId, 'settlements')),
};

export class BalanceService {
  constructor(private readonly app: FirebaseApp, private readonly repository: BalanceRepository = firestoreBalanceRepository) {}

  async load(groupId: string): Promise<{ totals: LedgerTotal[]; incompleteCount: number }> {
    const { expenses, settlements, incompleteCount } = await this.entries(groupId);
    return { totals: calculateBalances(expenses, settlements), incompleteCount };
  }

  async entries(groupId: string): Promise<{ expenses: ExpenseLedgerEntry[]; settlements: SettlementLedgerEntry[]; incompleteCount: number }> {
    const [expenseDocs, settlementDocs] = await Promise.all([
      this.repository.expenses(this.app, groupId),
      this.repository.settlements(this.app, groupId),
    ]);
    let incompleteCount = 0;
    const expenses: ExpenseLedgerEntry[] = [];
    for (const item of expenseDocs.docs) {
      const data = item.data();
      if (data['deleted'] === true) continue;
      if (!Array.isArray(data['payments']) || !Array.isArray(data['allocations'])) { incompleteCount++; continue; }
      expenses.push({ groupId, currency: String(data['currency']), date: String(data['date']), amountMinor: Number(data['amountMinor']), categoryId: String(data['categoryId'] ?? 'other'), categoryLabel: typeof data['categoryLabel'] === 'string' ? data['categoryLabel'] : undefined, payments: data['payments'], allocations: data['allocations'] });
    }
    const settlements: SettlementLedgerEntry[] = settlementDocs.docs.filter(item => item.data()['deleted'] !== true).map(item => {
      const data = item.data();
      return { groupId, currency: String(data['currency']), date: String(data['date']), amountMinor: Number(data['amountMinor']), fromUserId: String(data['fromUserId']), toUserId: String(data['toUserId']) };
    });
    return { expenses, settlements, incompleteCount };
  }
}
