/** Read one document through the Firestore REST transaction API. */
export async function readDocumentInTransaction(
  root: string,
  path: string,
  transaction: string,
  headers: Record<string, string>,
  transport: typeof fetch,
): Promise<Response> {
  const name = `${root}/${path}`;
  const response = await transport(`https://firestore.googleapis.com/v1/${root}:batchGet`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: [name], transaction }),
  });
  if (!response.ok) return response;
  try {
    const result = await response.json() as unknown;
    const item = Array.isArray(result) ? result[0] : result;
    if (!item || typeof item !== 'object') throw new Error('Invalid batchGet result');
    const record = item as Record<string, unknown>;
    if (record['missing'] === name) return new Response(null, { status: 404 });
    const found = record['found'];
    if (!found || typeof found !== 'object' || (found as Record<string, unknown>)['name'] !== name) throw new Error('Invalid batchGet document');
    return Response.json(found);
  } catch {
    return Response.json({ error: 'firestore_unavailable' }, { status: 503 });
  }
}

/** List a bounded subcollection through runQuery; collection GET ignores emulator transactions. */
export async function listDocumentsInTransaction(
  root: string,
  parent: string,
  collectionId: string,
  transaction: string,
  headers: Record<string, string>,
  transport: typeof fetch,
): Promise<Response> {
  const response = await transport(`https://firestore.googleapis.com/v1/${root}/${parent}:runQuery`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], limit: 51 }, transaction }),
  });
  if (!response.ok) return response;
  try {
    const rows = await response.json() as unknown;
    if (!Array.isArray(rows)) throw new Error('Invalid runQuery result');
    const documents = rows.map(row => {
      if (!row || typeof row !== 'object') throw new Error('Invalid runQuery row');
      const document = (row as Record<string, unknown>)['document'];
      if (document === undefined && typeof (row as Record<string, unknown>)['readTime'] === 'string') return null;
      if (!document || typeof document !== 'object') throw new Error('Invalid runQuery document');
      return document;
    }).filter(document => document !== null);
    return Response.json({ documents });
  } catch {
    return Response.json({ error: 'firestore_unavailable' }, { status: 503 });
  }
}

/** Page a collection using a transaction-aware query and a document-name cursor. */
export async function listCollectionPageInTransaction(
  root: string,
  path: string,
  pageSize: number,
  transaction: string,
  headers: Record<string, string>,
  transport: typeof fetch,
  cursor?: string,
): Promise<Response> {
  const separator = path.lastIndexOf('/');
  if (separator < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      (cursor && !cursor.startsWith(`${root}/${path}/`))) return Response.json({ error: 'invalid_query' }, { status: 503 });
  const parent = path.slice(0, separator);
  const collectionId = path.slice(separator + 1);
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
    limit: pageSize,
  };
  if (cursor) structuredQuery['startAt'] = { values: [{ referenceValue: cursor }], before: false };
  const response = await transport(`https://firestore.googleapis.com/v1/${root}/${parent}:runQuery`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery, transaction }),
  });
  if (!response.ok) return response;
  try {
    const rows = await response.json() as unknown;
    if (!Array.isArray(rows)) throw new Error('Invalid runQuery result');
    const documents = rows.map(row => {
      if (!row || typeof row !== 'object') throw new Error('Invalid runQuery row');
      const record = row as Record<string, unknown>;
      if (record['document'] === undefined && typeof record['readTime'] === 'string') return null;
      const document = record['document'];
      if (!document || typeof document !== 'object' || typeof (document as Record<string, unknown>)['name'] !== 'string') throw new Error('Invalid runQuery document');
      return document as Record<string, unknown>;
    }).filter((document): document is Record<string, unknown> => document !== null);
    const last = documents.at(-1)?.['name'];
    return Response.json({ documents, ...(documents.length === pageSize && typeof last === 'string' ? { nextPageToken: last } : {}) });
  } catch {
    return Response.json({ error: 'firestore_unavailable' }, { status: 503 });
  }
}
