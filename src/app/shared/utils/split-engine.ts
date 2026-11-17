/** Exact monetary allocation. All persisted amounts are safe integer minor units. */
export interface Allocation { readonly userId: string; readonly amountMinor: number; }
export type SplitMode =
  | { readonly kind: 'equal'; readonly users: readonly string[] }
  | { readonly kind: 'exact'; readonly amounts: readonly Allocation[] }
  | { readonly kind: 'percentage'; readonly weightsBasisPoints: readonly { userId: string; value: number }[] }
  | { readonly kind: 'shares'; readonly weights: readonly { userId: string; value: number }[] }
  | { readonly kind: 'adjustment'; readonly adjustments: readonly Allocation[] };

function validAmount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Montant invalide');
}
function unique(ids: readonly string[]): void {
  if (!ids.length || ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Participants invalides ou dupliqués');
  }
}
function distribute(amount: bigint, items: readonly { userId: string; weight: bigint }[]): Allocation[] {
  unique(items.map(item => item.userId));
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0n);
  if (totalWeight <= 0n || items.some(item => item.weight < 0n)) throw new Error('Poids invalides');
  const portions = items.map((item, index) => ({
    index, userId: item.userId,
    value: amount * item.weight / totalWeight,
    remainder: amount * item.weight % totalWeight,
  }));
  let left = amount - portions.reduce((sum, item) => sum + item.value, 0n);
  const priority = [...portions].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const item of priority) {
    if (left === 0n) break;
    portions[item.index].value++;
    left--;
  }
  return portions.map(item => ({ userId: item.userId, amountMinor: Number(item.value) }));
}

export function splitAmount(amountMinor: number, mode: SplitMode): Allocation[] {
  validAmount(amountMinor);
  const total = BigInt(amountMinor);
  switch (mode.kind) {
    case 'equal':
      return distribute(total, mode.users.map(userId => ({ userId, weight: 1n })));
    case 'exact': {
      unique(mode.amounts.map(item => item.userId));
      mode.amounts.forEach(item => validAmount(item.amountMinor));
      if (mode.amounts.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n) !== total) throw new Error('La somme des parts doit égaler le montant');
      return [...mode.amounts];
    }
    case 'percentage': {
      if (mode.weightsBasisPoints.some(item => !Number.isSafeInteger(item.value) || item.value < 0) ||
        mode.weightsBasisPoints.reduce((sum, item) => sum + item.value, 0) !== 10000) throw new Error('Les pourcentages doivent totaliser 100 %');
      return distribute(total, mode.weightsBasisPoints.map(item => ({ userId: item.userId, weight: BigInt(item.value) })));
    }
    case 'shares': {
      if (mode.weights.some(item => !Number.isSafeInteger(item.value) || item.value < 0)) throw new Error('Parts invalides');
      return distribute(total, mode.weights.map(item => ({ userId: item.userId, weight: BigInt(item.value) })));
    }
    case 'adjustment': {
      unique(mode.adjustments.map(item => item.userId));
      if (mode.adjustments.some(item => !Number.isSafeInteger(item.amountMinor))) throw new Error('Ajustement invalide');
      const adjusted = mode.adjustments.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
      const rest = total - adjusted;
      if (rest < 0n) throw new Error('Ajustements supérieurs au total');
      const base = distribute(rest, mode.adjustments.map(item => ({ userId: item.userId, weight: 1n })));
      const result = base.map((item, index) => ({ userId: item.userId, amountMinor: item.amountMinor + mode.adjustments[index].amountMinor }));
      if (result.some(item => !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0)) throw new Error('Part invalide');
      return result;
    }
  }
}

export function validateExpense(amountMinor: number, payments: readonly Allocation[], allocations: readonly Allocation[], members: ReadonlySet<string>): void {
  validAmount(amountMinor);
  for (const entries of [payments, allocations]) {
    unique(entries.map(item => item.userId));
    entries.forEach(item => { validAmount(item.amountMinor); if (!members.has(item.userId)) throw new Error('Participant hors du groupe'); });
    if (entries.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n) !== BigInt(amountMinor)) throw new Error('Somme incohérente');
  }
}
