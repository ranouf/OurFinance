/** Fixed public codes only; never include upstream URLs, signatures, tokens or error messages. */
export class MediaDiagnosticError extends Error {
  constructor(readonly code: 'member_read' | 'expense_read' | 'metadata_read' | 'download_sign' | 'download_fetch' | 'download_redirect' | 'download_response') {
    super(code);
  }
}

export async function fetchCloudinaryPrivate(url: URL, transport: typeof fetch = fetch): Promise<Response> {
  let response: Response;
  try { response = await transport(url, { redirect: 'manual' }); }
  catch { throw new MediaDiagnosticError('download_fetch'); }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (!location) throw new MediaDiagnosticError('download_redirect');
    let destination: URL;
    try { destination = new URL(location, url); }
    catch { throw new MediaDiagnosticError('download_redirect'); }
    if (destination.protocol !== 'https:' || !['api.cloudinary.com', 'res.cloudinary.com'].includes(destination.hostname) || destination.username || destination.password) {
      throw new MediaDiagnosticError('download_redirect');
    }
    try { return await transport(destination, { redirect: 'error' }); }
    catch { throw new MediaDiagnosticError('download_fetch'); }
  }
  return response;
}
