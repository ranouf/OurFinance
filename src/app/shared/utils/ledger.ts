import { Allocation, validateExpense } from './split-engine';
import { convertMinor } from './exchange-rate';

export interface ExpenseLedgerEntry {
  readonly groupId: string;
  readonly currency: string;
  readonly date: string;
  readonly amountMinor: number;
  readonly payments: readonly Allocation[];
  readonly allocations: readonly Allocation[];
  readonly deleted?: boolean;
}
export interface SettlementLedgerEntry {
  readonly groupId: string;
  readonly currency: string;
  readonly date: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly amountMinor: number;
  readonly deleted?: boolean;
}
/** The debt is cleared in debtCurrency; paymentCurrency is a cash trace, not another debt balance. */
export interface FxSettlementLedgerEntry {
  readonly groupId: string;
  readonly date: string;
  readonly debtCurrency: string;
  readonly debtAmountMinor: number;
  readonly paymentCurrency: string;
  readonly paymentAmountMinor: number;
  readonly rate: string;
  readonly rateDate: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly deleted?: boolean;
}
export interface LedgerTotal {
  readonly groupId: string;
  readonly currency: string;
  readonly userId: string;
  paidMinor: bigint;
  owedMinor: bigint;
  settlementsSentMinor: bigint;
  settlementsReceivedMinor: bigint;
  balanceMinor: bigint;
}

/** Derives balances from source entries; never mixes currencies or groups. */
export function calculateBalances(expenses: readonly ExpenseLedgerEntry[], settlements: readonly SettlementLedgerEntry[], start?: string, end?: string, fxSettlements: readonly FxSettlementLedgerEntry[] = []): LedgerTotal[] {
  const totals = new Map<string, LedgerTotal>();
  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);
  const row = (groupId: string, currency: string, userId: string): LedgerTotal => {
    const key = JSON.stringify([groupId, currency, userId]);
    let current = totals.get(key);
    if (!current) {
      current = { groupId, currency, userId, paidMinor: 0n, owedMinor: 0n, settlementsSentMinor: 0n, settlementsReceivedMinor: 0n, balanceMinor: 0n };
      totals.set(key, current);
    }
    return current;
  };
  for (const expense of expenses) {
    if (expense.deleted || !inRange(expense.date)) continue;
    validateExpense(expense.amountMinor, expense.payments, expense.allocations,
      new Set([...expense.payments, ...expense.allocations].map(item => item.userId)));
    for (const payment of expense.payments) row(expense.groupId, expense.currency, payment.userId).paidMinor += BigInt(payment.amountMinor);
    for (const allocation of expense.allocations) row(expense.groupId, expense.currency, allocation.userId).owedMinor += BigInt(allocation.amountMinor);
  }
  for (const settlement of settlements) {
    if (settlement.deleted || !inRange(settlement.date)) continue;
    if (!Number.isSafeInteger(settlement.amountMinor) || settlement.amountMinor <= 0 || settlement.fromUserId === settlement.toUserId) throw new Error('Règlement invalide');
    row(settlement.groupId, settlement.currency, settlement.fromUserId).settlementsSentMinor += BigInt(settlement.amountMinor);
    row(settlement.groupId, settlement.currency, settlement.toUserId).settlementsReceivedMinor += BigInt(settlement.amountMinor);
  }
  for (const settlement of fxSettlements) {
    if (settlement.deleted || !inRange(settlement.date)) continue;
    if (!Number.isSafeInteger(settlement.debtAmountMinor) || settlement.debtAmountMinor <= 0 ||
        !Number.isSafeInteger(settlement.paymentAmountMinor) || settlement.paymentAmountMinor <= 0 ||
        settlement.debtCurrency === settlement.paymentCurrency || settlement.fromUserId === settlement.toUserId ||
        convertMinor(settlement.debtAmountMinor, { sourceCurrency: settlement.debtCurrency, targetCurrency: settlement.paymentCurrency,
          rate: settlement.rate, date: settlement.rateDate, origin: 'manual' }) !== settlement.paymentAmountMinor) throw new Error('Règlement interdevises invalide');
    row(settlement.groupId, settlement.debtCurrency, settlement.fromUserId).settlementsSentMinor += BigInt(settlement.debtAmountMinor);
    row(settlement.groupId, settlement.debtCurrency, settlement.toUserId).settlementsReceivedMinor += BigInt(settlement.debtAmountMinor);
  }
  for (const total of totals.values()) total.balanceMinor = total.paidMinor - total.owedMinor + total.settlementsSentMinor - total.settlementsReceivedMinor;
  return [...totals.values()].sort((a, b) => JSON.stringify([a.groupId,a.currency,a.userId]).localeCompare(JSON.stringify([b.groupId,b.currency,b.userId])));
}
