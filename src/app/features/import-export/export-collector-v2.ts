import type { User } from 'firebase/auth';
import { collectGroupExportV1, type ExportReader } from './export-collector';
import type { GroupExportV1 } from './export-v1';
import { serializeGroupExportV2, type FxExportEntryV2, type GroupExportV2 } from './export-v2';

const text = (data: Record<string, unknown>, key: string): string => {
  if (typeof data[key] !== 'string') throw new Error(`Champ FX ${key} manquant`);
  return data[key] as string;
};
const integer = (data: Record<string, unknown>, key: string): number => {
  if (!Number.isSafeInteger(data[key])) throw new Error(`Champ FX ${key} invalide`);
  return data[key] as number;
};

/** Reads V1 collections plus FX operations, rechecking membership after the final read. */
export async function collectGroupExportV2(reader: ExportReader, user: Pick<User, 'uid' | 'emailVerified'>,
  groupId: string, exportedAt = new Date().toISOString()): Promise<string> {
  const base = JSON.parse(await collectGroupExportV1(reader, user, groupId, exportedAt)) as GroupExportV1;
  const fxDocuments = await reader.list(`groups/${groupId}/fxSettlements`);
  const fxSettlements: FxExportEntryV2[] = fxDocuments.map(item => ({
    id: item.id, date: text(item.data, 'date'), debtCurrency: text(item.data, 'debtCurrency'),
    debtAmountMinor: integer(item.data, 'debtAmountMinor'), paymentCurrency: text(item.data, 'paymentCurrency'),
    paymentAmountMinor: integer(item.data, 'paymentAmountMinor'), rate: text(item.data, 'rate'), rateDate: text(item.data, 'rateDate'),
    fromUserId: text(item.data, 'fromUserId'), toUserId: text(item.data, 'toUserId'),
    status: text(item.data, 'status') as 'recorded', deleted: item.data['deleted'] as boolean,
  }));
  if ((await reader.read(`groups/${groupId}/members/${user.uid}`))?.data['status'] !== 'active') throw new Error('Membre révoqué pendant l’export FX');
  return serializeGroupExportV2({ ...base, version: 2, fxSettlements } satisfies GroupExportV2);
}
