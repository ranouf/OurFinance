/** Adapt legacy document GET fixtures to Firestore's transactional batchGet response. */
export function withBatchGet(transport: (resource: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (!url.endsWith(':batchGet')) return transport(resource, init);
    const body = JSON.parse(String(init?.body)) as { documents: string[]; transaction: string };
    const name = body.documents[0];
    const legacy = await transport(`${name.replace('projects/', 'https://firestore.googleapis.com/v1/projects/')}?transaction=${encodeURIComponent(body.transaction)}`, { headers: init?.headers });
    if (legacy.status === 404) return Response.json([{ missing: name }]);
    if (!legacy.ok) return legacy;
    return Response.json([{ found: { name, ...await legacy.json() } }]);
  }) as typeof fetch;
}
