import { prepareExpense, type ExpenseDraft } from './expense-draft';

/** Impact of this draft alone; group balances and past repayments are excluded. */
export function expenseImpact(draft: ExpenseDraft, activeIds: ReadonlySet<string>, userId: string): { total: number; paid: number; owed: number; net: number } {
  const result = prepareExpense(draft, activeIds);
  const paid = result.payments.find(row => row.userId === userId)?.amountMinor ?? 0;
  const owed = result.allocations.find(row => row.userId === userId)?.amountMinor ?? 0;
  return { total: result.amountMinor, paid, owed, net: paid - owed };
}
