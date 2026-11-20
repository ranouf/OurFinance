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
    method: 'POST', headers, body: JSON.stringify({ documents: [name], transaction }),
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
