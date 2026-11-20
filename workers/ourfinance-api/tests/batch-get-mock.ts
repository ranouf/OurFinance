/** Adapt legacy document GET fixtures to Firestore's transactional batchGet response. */
export function withBatchGet(transport: (resource: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.endsWith(':runQuery')) {
      const body = JSON.parse(String(init?.body)) as { structuredQuery: { from: Array<{ collectionId: string; allDescendants?: boolean }>; limit?: number; startAt?: { values?: Array<{ referenceValue?: string }> } }; transaction: string };
      if (body.structuredQuery.from[0]?.allDescendants) return transport(resource, init);
      const collection = body.structuredQuery.from[0]?.collectionId;
      const cursor = body.structuredQuery.startAt?.values?.[0]?.referenceValue;
      const index = cursor?.match(/(?:e|item_)(\d+)$/)?.[1];
      const pageToken = index === undefined ? '' : `&pageToken=${Number(index) + 1}`;
      const legacy = await transport(`${url.slice(0, -':runQuery'.length)}/${collection}?transaction=${encodeURIComponent(body.transaction)}&pageSize=${body.structuredQuery.limit ?? 51}${pageToken}`, { headers: init?.headers });
      if (!legacy.ok) return legacy;
      const data = await legacy.json() as { documents?: unknown; nextPageToken?: string };
      if (data.nextPageToken && !Array.isArray(data.documents)) return Response.json(Array.from({ length: body.structuredQuery.limit ?? 51 }, () => ({ document: {} })));
      if (data.documents === undefined) return Response.json([]);
      if (!Array.isArray(data.documents)) return Response.json(data);
      return Response.json(data.documents.map(document => ({ document })));
    }
    if (!url.endsWith(':batchGet')) return transport(resource, init);
    const body = JSON.parse(String(init?.body)) as { documents: string[]; transaction: string };
    const name = body.documents[0];
    const legacy = await transport(`${name.replace('projects/', 'https://firestore.googleapis.com/v1/projects/')}?transaction=${encodeURIComponent(body.transaction)}`, { headers: init?.headers });
    if (legacy.status === 404) return Response.json([{ missing: name }]);
    if (!legacy.ok) return legacy;
    return Response.json([{ found: { name, ...await legacy.json() } }]);
  }) as typeof fetch;
}
