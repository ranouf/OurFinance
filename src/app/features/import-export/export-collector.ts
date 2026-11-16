import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, doc, documentId, getDoc, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { serializeGroupExportV1, type GroupExportV1 } from './export-v1';

export interface ExportDocument { readonly id: string; readonly data: Record<string, unknown> }
export interface ExportReader {
  read(path: string): Promise<ExportDocument | null>;
  list(path: string): Promise<readonly ExportDocument[]>;
}

/** Reads every page through client security rules, with no service credentials. */
export class FirebaseExportReader implements ExportReader {
  constructor(private readonly app: FirebaseApp) {}
  async read(path: string): Promise<ExportDocument | null> {
    const snapshot = await getDoc(doc(getFirestore(this.app), path));
    return snapshot.exists() ? { id: snapshot.id, data: snapshot.data() } : null;
  }
  async list(path: string): Promise<ExportDocument[]> {
    const source = collection(getFirestore(this.app), path);
    const result: ExportDocument[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
    while (true) {
      const page = await getDocs(query(source, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(50)));
      result.push(...page.docs.map(item => ({ id: item.id, data: item.data() })));
      if (page.size < 50) return result;
      cursor = page.docs.at(-1)!;
    }
  }
}

const text = (data: Record<string, unknown>, key: string): string => {
  const value = data[key];
  if (typeof value !== 'string') throw new Error(`Champ ${key} absent de l’export`);
  return value;
};
const oneOf = <T extends string>(data: Record<string, unknown>, key: string, allowed: readonly T[]): T => {
  const value = text(data, key);
  if (!allowed.includes(value as T)) throw new Error(`Champ ${key} invalide pour l’export`);
  return value as T;
};
const integer = (data: Record<string, unknown>, key: string): number => {
  const value = data[key];
  if (!Number.isSafeInteger(value)) throw new Error(`Champ ${key} invalide pour l’export`);
  return value as number;
};
const boolean = (data: Record<string, unknown>, key: string): boolean => {
  const value = data[key];
  if (typeof value !== 'boolean') throw new Error(`Champ ${key} absent de l’export`);
  return value;
};
const entries = (data: Record<string, unknown>, key: string): { userId: string; amountMinor: number }[] => {
  const value = data[key];
  if (!Array.isArray(value)) throw new Error(`Champ ${key} absent de l’export`);
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error(`Champ ${key} invalide pour l’export`);
    return { userId: text(item as Record<string, unknown>, 'userId'), amountMinor: integer(item as Record<string, unknown>, 'amountMinor') };
  });
};
const impacts = (data: Record<string, unknown>): Record<string, number> => {
  const value = data['netImpactsMinor'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Impacts historiques absents de l’export');
  return Object.fromEntries(Object.entries(value).map(([userId, amount]) => {
    if (!Number.isSafeInteger(amount)) throw new Error('Impact historique invalide');
    return [userId, amount as number];
  }));
};

/** Produces a metadata-only group JSON; rejects missing pages or inconsistent records. */
export async function collectGroupExportV1(reader: ExportReader, user: Pick<User, 'uid' | 'emailVerified'>, groupId: string, exportedAt = new Date().toISOString()): Promise<string> {
  if (!user.emailVerified || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)) throw new Error('Export non autorisé');
  const root = `groups/${groupId}`;
  const group = await reader.read(root);
  if (!group || group.data['status'] !== 'active') throw new Error('Groupe indisponible');
  const ownMembership = await reader.read(`${root}/members/${user.uid}`);
  if (ownMembership?.data['status'] !== 'active') throw new Error('Membre inactif');

  const [members, expenses, settlements, importedRecords, categories] = await Promise.all([
    reader.list(`${root}/members`), reader.list(`${root}/expenses`), reader.list(`${root}/settlements`),
    reader.list(`${root}/importedRecords`), reader.list(`${root}/categories`),
  ]);
  const receiptPages = await Promise.all(expenses.map(expense => reader.list(`${root}/expenses/${expense.id}/attachments`)));
  const body: GroupExportV1 = {
    format: 'OurFinanceGroupExport', version: 1, exportedAt,
    group: { id: groupId, name: text(group.data, 'name'), currency: text(group.data, 'currency') },
    members: members.map(item => ({ userId: item.id, role: text(item.data, 'role') as 'owner' | 'member', status: text(item.data, 'status') as 'active' | 'revoked' })),
    expenses: expenses.map(item => ({
      id: item.id, date: text(item.data, 'date'), description: text(item.data, 'description'), currency: text(item.data, 'currency'), amountMinor: integer(item.data, 'amountMinor'),
      categoryId: text(item.data, 'categoryId'), categoryLabel: text(item.data, 'categoryLabel'), categoryIcon: text(item.data, 'categoryIcon'), categoryColor: text(item.data, 'categoryColor'),
      payments: entries(item.data, 'payments'), allocations: entries(item.data, 'allocations'), splitSnapshotJson: text(item.data, 'splitSnapshotJson'), deleted: boolean(item.data, 'deleted'),
    })),
    settlements: settlements.map(item => ({
      id: item.id, date: text(item.data, 'date'), currency: text(item.data, 'currency'), amountMinor: integer(item.data, 'amountMinor'),
      fromUserId: text(item.data, 'fromUserId'), toUserId: text(item.data, 'toUserId'), status: oneOf(item.data, 'status', ['recorded'] as const), deleted: boolean(item.data, 'deleted'),
    })),
    importedRecords: importedRecords.map(item => ({
      id: item.id, sourceId: text(item.data, 'sourceId'), batchId: text(item.data, 'batchId'), date: text(item.data, 'date'),
      description: text(item.data, 'description'), currency: text(item.data, 'currency'), amountMinor: integer(item.data, 'amountMinor'),
      netImpactsMinor: impacts(item.data), splitStatus: text(item.data, 'splitStatus') as 'undetermined', status: text(item.data, 'status') as 'active' | 'undone',
    })),
    categories: categories.map(item => ({ id: item.id, name: text(item.data, 'name'), iconId: text(item.data, 'iconId'), color: text(item.data, 'color'), status: oneOf(item.data, 'status', ['active', 'archived'] as const) })),
    receipts: receiptPages.flatMap((page, index) => page.map(item => ({
      expenseId: expenses[index].id, attachmentId: item.id, format: oneOf(item.data, 'format', ['jpg', 'png'] as const), status: oneOf(item.data, 'status', ['active', 'deleted'] as const), mediaIncluded: false as const,
    }))),
  };
  // A membership change during pagination must not produce a file for a revoked user.
  if ((await reader.read(`${root}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant l’export');
  return serializeGroupExportV1(body);
}
