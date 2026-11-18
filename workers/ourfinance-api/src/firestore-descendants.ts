/** Paged collection-group reads under one group and one Firestore transaction. */
import { isProviderQuotaStatus, ProviderQuotaError } from './provider-quota';

export interface DescendantDocument { readonly name: string; readonly fields?: Record<string, unknown> }
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;

export async function listExpenseDescendants(
  root: string, groupId: string, collectionId: 'attachments' | 'comments', transaction: string,
  headers: HeadersInit, transport: typeof fetch, maxDocuments = 5000,
): Promise<Map<string, DescendantDocument[]>> {
  if (!idPattern.test(groupId) || maxDocuments < 1) throw new Error('invalid_path');
  const parent = `groups/${groupId}`;
  const result = new Map<string, DescendantDocument[]>();
  let cursor: string | undefined;
  let count = 0;
  for (let page = 0; page < 100; page++) {
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId, allDescendants: true }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: 100,
    };
    if (cursor) structuredQuery['startAt'] = { values: [{ referenceValue: cursor }], before: false };
    const response = await transport(`https://firestore.googleapis.com/v1/${root}/${parent}:runQuery`, {
      method: 'POST', headers, body: JSON.stringify({ structuredQuery, transaction }),
    });
    if (isProviderQuotaStatus(response.status)) throw new ProviderQuotaError();
    if (!response.ok) throw new Error('firestore_unavailable');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('invalid_query');
    const documents = rows.filter((row): row is { document: DescendantDocument } =>
      !!row && typeof row === 'object' && 'document' in row && !!row.document);
    if (documents.length > 100 || count + documents.length > maxDocuments) throw new Error('inventory_too_large');
    for (const { document } of documents) {
      const prefix = `${root}/${parent}/expenses/`;
      if (!document.name?.startsWith(prefix)) throw new Error('invalid_query');
      const parts = document.name.slice(prefix.length).split('/');
      if (parts.length !== 3 || !idPattern.test(parts[0]) || parts[1] !== collectionId || !idPattern.test(parts[2])) {
        throw new Error('invalid_query');
      }
      const path = `${parent}/expenses/${parts[0]}/${collectionId}`;
      result.set(path, [...(result.get(path) ?? []), document]);
      cursor = document.name;
    }
    count += documents.length;
    if (documents.length < 100) return result;
  }
  throw new Error('inventory_too_large');
}
