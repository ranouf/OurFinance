import { parseCsv } from './csv';

export interface NativeSplitwiseRow {
  readonly date: string;
  readonly description: string;
  readonly category: string;
  readonly currency: string;
  /** Decimal strings preserve source precision, including fractions of zero-decimal currencies. */
  readonly cost: string;
  readonly impacts: Readonly<Record<string, string>>;
}

export interface NativeSplitwiseCsv {
  readonly currency: string;
  readonly participants: readonly string[];
  readonly rows: readonly NativeSplitwiseRow[];
  readonly balances: Readonly<Record<string, string>>;
}

export interface NativeSplitwiseReconciliation {
  readonly matched: boolean;
  readonly differences: Readonly<Record<string, string>>;
}

const decimal = /^-?\d+(?:\.\d+)?$/;
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function scaled(value: string, digits: number): bigint {
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const magnitude = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  return value.startsWith('-') ? -magnitude : magnitude;
}

/** Reads a native group or friend export without changing monetary precision. */
export function parseNativeSplitwiseCsv(input: string): NativeSplitwiseCsv {
  const lines = parseCsv(input.replace(/^\uFEFF/, '')).filter(row => row.some(cell => cell.trim()));
  const headerIndex = lines.findIndex(row => row[0]?.trim() === 'Date' && row[1]?.trim() === 'Description');
  if (headerIndex < 0) throw new Error('En-tête Splitwise introuvable');
  const header = lines[headerIndex];
  if (header.length < 6 || header[3]?.trim() !== 'Coût' || header[4]?.trim() !== 'Devise') throw new Error('Colonnes Splitwise invalides');
  const participants = header.slice(5).map(value => value.trim());
  if (participants.some(value => !value) || new Set(participants).size !== participants.length) throw new Error('Participants invalides');
  const rows: NativeSplitwiseRow[] = [];
  let balances: Readonly<Record<string, string>> = {};
  let currency = '';
  const body = lines.slice(headerIndex + 1);
  for (const [index, raw] of body.entries()) {
    if (raw.length !== header.length) throw new Error(`Ligne ${headerIndex + index + 2} : nombre de colonnes invalide`);
    const values = raw.map(value => value.trim());
    const impacts = Object.fromEntries(participants.map((person, position) => [person, values[position + 5]]));
    if (index === body.length - 1 && !values[3] && validDate(values[0])) {
      if (values[4] !== currency || Object.values(impacts).some(value => !decimal.test(value))) throw new Error('Soldes Splitwise invalides');
      balances = impacts;
      continue;
    }
    if (!validDate(values[0]) || !values[1] || !decimal.test(values[3]) || scaled(values[3], (values[3].split('.')[1] ?? '').length) <= 0n ||
        !Intl.supportedValuesOf('currency').includes(values[4]) || Object.values(impacts).some(value => !decimal.test(value))) {
      throw new Error(`Ligne ${headerIndex + index + 2} : transaction Splitwise invalide`);
    }
    const digits = Math.max(...Object.values(impacts).map(value => (value.split('.')[1] ?? '').length));
    if (Object.values(impacts).reduce((sum, value) => sum + scaled(value, digits), 0n) !== 0n) {
      throw new Error(`Ligne ${headerIndex + index + 2} : impacts non équilibrés`);
    }
    if (currency && values[4] !== currency) throw new Error(`Ligne ${headerIndex + index + 2} : devise incohérente`);
    currency = values[4];
    rows.push({ date: values[0], description: values[1], category: values[2], cost: values[3], currency: values[4], impacts });
  }
  if (!rows.length || !Object.keys(balances).length) throw new Error('Transactions ou solde final absents');
  return { currency, participants, rows, balances };
}

/** Compares the native final balance with transaction impacts at source precision. */
export function reconcileNativeSplitwiseCsv(source: NativeSplitwiseCsv): NativeSplitwiseReconciliation {
  if (source.participants.some(person => !decimal.test(source.balances[person] ?? ''))) throw new Error('Solde final absent');
  const digits = Math.max(0, ...source.rows.flatMap(row => Object.values(row.impacts).map(value => (value.split('.')[1] ?? '').length)),
    ...Object.values(source.balances).map(value => (value.split('.')[1] ?? '').length));
  const differences = Object.fromEntries(source.participants.map(person => {
    const total = source.rows.reduce((sum, row) => sum + scaled(row.impacts[person], digits), 0n);
    const difference = total - scaled(source.balances[person], digits);
    const magnitude = (difference < 0n ? -difference : difference).toString().padStart(digits + 1, '0');
    const formatted = digits ? `${magnitude.slice(0, -digits)}.${magnitude.slice(-digits)}` : magnitude;
    return [person, `${difference < 0n ? '-' : ''}${formatted}`];
  }));
  return { matched: Object.values(differences).every(value => scaled(value, digits) === 0n), differences };
}
