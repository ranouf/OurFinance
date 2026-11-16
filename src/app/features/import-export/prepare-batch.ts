import type { ImportPreviewV1 } from './import-v1';

export interface PreparedImportBatch {
  readonly groupId: string;
  readonly body: {
    readonly batchId: string;
    readonly records: readonly {
      readonly sourceId: string;
      readonly date: string;
      readonly description: string;
      readonly currency: string;
      readonly amountMinor: number;
      readonly netImpactsMinor: Readonly<Record<string, number>>;
    }[];
  };
}

const documentId = /^[A-Za-z0-9_-]{1,128}$/;
const batchIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/** Fail closed: incomplete previews and ambiguous account mapping never reach the Worker. */
export function prepareImportBatch(
  preview: ImportPreviewV1,
  sourceGroupId: string,
  targetGroupId: string,
  targetCurrency: string,
  memberMapping: Readonly<Record<string, string>>,
  batchId: string,
): PreparedImportBatch {
  if (preview.version !== 1 || preview.errors.length || preview.duplicateIds.length ||
      !documentId.test(sourceGroupId) || !documentId.test(targetGroupId) || !batchIdPattern.test(batchId) ||
      preview.records.length < 1 || preview.records.length > 10 ||
      preview.records.some(record => record.groupId !== sourceGroupId)) throw new Error('Aperçu incomplet ou groupe ambigu');
  if (!Intl.supportedValuesOf('currency').includes(targetCurrency)) throw new Error('Devise du groupe cible invalide');
  const incompatible = [...new Set(preview.records.filter(record => record.currency !== targetCurrency).map(record => record.currency))];
  if (incompatible.length) throw new Error(`Devise incompatible avec le groupe cible (${targetCurrency}) : ${incompatible.join(', ')}. Choisir un groupe de la bonne devise ou exclure ces lignes.`);

  const mappedIds = Object.values(memberMapping);
  if (!mappedIds.length || mappedIds.some(id => !documentId.test(id)) || new Set(mappedIds).size !== mappedIds.length) {
    throw new Error('Correspondance des membres invalide ou ambiguë');
  }
  const records = preview.records.map(record => {
    const impacts = record.netImpactsMinor;
    if (!impacts || !Object.keys(impacts).length) throw new Error('Impacts historiques manquants');
    const mappedEntries: [string, number][] = [];
    for (const [sourceUserId, amount] of Object.entries(impacts)) {
      const targetUserId = Object.hasOwn(memberMapping, sourceUserId) ? memberMapping[sourceUserId] : undefined;
      if (!targetUserId || !Number.isSafeInteger(amount)) throw new Error('Membre ou impact invalide');
      mappedEntries.push([targetUserId, amount]);
    }
    const mapped = Object.fromEntries(mappedEntries) as Record<string, number>;
    if (Object.values(mapped).reduce((sum, amount) => sum + BigInt(amount), 0n) !== 0n) {
      throw new Error('Impacts historiques non équilibrés');
    }
    return {
      sourceId: record.sourceId,
      date: record.date,
      description: record.description,
      currency: record.currency,
      amountMinor: record.amountMinor,
      netImpactsMinor: mapped,
    };
  });
  return { groupId: targetGroupId, body: { batchId, records } };
}
