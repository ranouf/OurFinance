import type { Allocation } from '../../shared/utils/split-engine';

/** Group-level portable data. Media bytes and account settings require separate exports. */
export interface GroupExportV1 {
  readonly format: 'OurFinanceGroupExport';
  readonly version: 1;
  readonly exportedAt: string;
  readonly group: { readonly id: string; readonly name: string; readonly currency: string };
  readonly members: readonly { readonly userId: string; readonly role: 'owner' | 'member'; readonly status: 'active' | 'revoked' }[];
  readonly expenses: readonly {
    readonly id: string; readonly date: string; readonly description: string; readonly currency: string; readonly amountMinor: number;
    readonly payments: readonly Allocation[]; readonly allocations: readonly Allocation[]; readonly splitSnapshotJson: string;
    readonly deleted: boolean;
  }[];
  readonly settlements: readonly {
    readonly id: string; readonly date: string; readonly currency: string; readonly amountMinor: number;
    readonly fromUserId: string; readonly toUserId: string; readonly status: string; readonly deleted: boolean;
  }[];
  readonly importedRecords: readonly {
    readonly id: string; readonly sourceId: string; readonly batchId: string; readonly date: string; readonly description: string;
    readonly currency: string; readonly amountMinor: number; readonly netImpactsMinor: Readonly<Record<string, number>>;
    readonly splitStatus: 'undetermined'; readonly status: 'active' | 'undone';
  }[];
  readonly categories: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly status: string }[];
  readonly receipts: readonly {
    readonly expenseId: string; readonly attachmentId: string; readonly format: 'jpg' | 'png'; readonly status: string;
    /** Metadata only: a separate authorized binary export is required. */
    readonly mediaIncluded: false;
  }[];
}

const id = /^[A-Za-z0-9_-]{1,128}$/;
const currency = (value: string) => Intl.supportedValuesOf('currency').includes(value);
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const amount = (value: number) => Number.isSafeInteger(value) && value > 0;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + BigInt(value), 0n);

/** Refuses an incomplete or inconsistent snapshot before a JSON file can be offered. */
export function validateGroupExportV1(value: GroupExportV1): void {
  if (value.format !== 'OurFinanceGroupExport' || value.version !== 1 || !Number.isFinite(Date.parse(value.exportedAt)) ||
      !id.test(value.group.id) || !value.group.name.trim() || !currency(value.group.currency) ||
      !value.members.length || !unique(value.members.map(row => row.userId)) ||
      value.members.some(row => !id.test(row.userId) || !['owner', 'member'].includes(row.role) || !['active', 'revoked'].includes(row.status))) {
    throw new Error('En-tête ou membres de l’export invalides');
  }
  const memberIds = new Set(value.members.map(row => row.userId));
  const validateCollection = (rows: readonly { id: string }[]) => {
    if (!unique(rows.map(row => row.id)) || rows.some(row => !id.test(row.id))) throw new Error('Identifiants de documents invalides');
  };
  validateCollection(value.expenses); validateCollection(value.settlements); validateCollection(value.importedRecords); validateCollection(value.categories);
  for (const row of value.expenses) {
    const entries = [...row.payments, ...row.allocations];
    if (!date(row.date) || !row.description.trim() || !currency(row.currency) || !amount(row.amountMinor) ||
        !row.payments.length || !row.allocations.length || !row.splitSnapshotJson ||
        entries.some(entry => !memberIds.has(entry.userId) || !Number.isSafeInteger(entry.amountMinor)) ||
        sum(row.payments.map(entry => entry.amountMinor)) !== BigInt(row.amountMinor) ||
        sum(row.allocations.map(entry => entry.amountMinor)) !== BigInt(row.amountMinor)) throw new Error(`Dépense ${row.id} incohérente`);
  }
  for (const row of value.settlements) {
    if (!date(row.date) || !currency(row.currency) || !amount(row.amountMinor) ||
        !memberIds.has(row.fromUserId) || !memberIds.has(row.toUserId) || row.fromUserId === row.toUserId) throw new Error(`Règlement ${row.id} incohérent`);
  }
  for (const row of value.importedRecords) {
    const impacts = Object.entries(row.netImpactsMinor);
    if (!row.sourceId || !id.test(row.batchId) || !date(row.date) || !row.description.trim() || !currency(row.currency) ||
        !amount(row.amountMinor) || row.splitStatus !== 'undetermined' || !['active', 'undone'].includes(row.status) ||
        !impacts.length || impacts.some(([userId, impact]) => !memberIds.has(userId) || !Number.isSafeInteger(impact)) ||
        sum(impacts.map(([, impact]) => impact)) !== 0n) throw new Error(`Import ${row.id} incohérent`);
  }
  if (value.categories.some(row => !row.name.trim() || !row.icon.trim())) throw new Error('Catégorie invalide');
  const expenseIds = new Set(value.expenses.map(row => row.id));
  if (!unique(value.receipts.map(row => `${row.expenseId}/${row.attachmentId}`)) ||
      value.receipts.some(row => !expenseIds.has(row.expenseId) || !id.test(row.attachmentId) || !['jpg', 'png'].includes(row.format) || row.mediaIncluded !== false)) {
    throw new Error('Métadonnées de reçu invalides');
  }
}

export function serializeGroupExportV1(value: GroupExportV1): string {
  validateGroupExportV1(value);
  const clean: GroupExportV1 = {
    format: 'OurFinanceGroupExport', version: 1, exportedAt: value.exportedAt,
    group: { id: value.group.id, name: value.group.name, currency: value.group.currency },
    members: value.members.map(row => ({ userId: row.userId, role: row.role, status: row.status })),
    expenses: value.expenses.map(row => ({
      id: row.id, date: row.date, description: row.description, currency: row.currency, amountMinor: row.amountMinor,
      payments: row.payments.map(item => ({ userId: item.userId, amountMinor: item.amountMinor })),
      allocations: row.allocations.map(item => ({ userId: item.userId, amountMinor: item.amountMinor })),
      splitSnapshotJson: row.splitSnapshotJson, deleted: row.deleted,
    })),
    settlements: value.settlements.map(row => ({
      id: row.id, date: row.date, currency: row.currency, amountMinor: row.amountMinor,
      fromUserId: row.fromUserId, toUserId: row.toUserId, status: row.status, deleted: row.deleted,
    })),
    importedRecords: value.importedRecords.map(row => ({
      id: row.id, sourceId: row.sourceId, batchId: row.batchId, date: row.date, description: row.description,
      currency: row.currency, amountMinor: row.amountMinor, netImpactsMinor: Object.fromEntries(Object.entries(row.netImpactsMinor)),
      splitStatus: row.splitStatus, status: row.status,
    })),
    categories: value.categories.map(row => ({ id: row.id, name: row.name, icon: row.icon, status: row.status })),
    receipts: value.receipts.map(row => ({
      expenseId: row.expenseId, attachmentId: row.attachmentId, format: row.format, status: row.status, mediaIncluded: false,
    })),
  };
  return `${JSON.stringify(clean, null, 2)}\n`;
}
