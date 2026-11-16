export class RequestBodyError extends Error {
  constructor(readonly code: 'body_too_large' | 'invalid_json') { super(code); }
}

/** Bound streamed JSON by UTF-8 bytes even when Content-Length is absent or false. */
export async function readLimitedJson(request: Request, limit: number): Promise<unknown> {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) throw new RequestBodyError('body_too_large');
  if (!request.body) throw new RequestBodyError('invalid_json');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel().catch(() => undefined); throw new RequestBodyError('body_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('invalid_json');
  }
}
