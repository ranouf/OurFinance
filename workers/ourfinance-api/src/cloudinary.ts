export interface CloudinaryEnv {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

export async function signCloudinary(params: Readonly<Record<string, string>>, secret: string): Promise<string> {
  const source = Object.entries(params).filter(([, value]) => value !== '').map(([key, value]) => `${key}=${value}`).sort().join('&') + secret;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function imageFormat(bytes: Uint8Array, mime: string): 'jpg' | 'png' {
  if (bytes.length > 2_000_000 || bytes.length < 16) throw new Error('Taille d’image invalide');
  if (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (mime === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'png';
  throw new Error('Image JPEG/PNG valide requise');
}

export async function authenticatedDownloadUrl(publicId: string, format: 'jpg' | 'png', env: CloudinaryEnv, now = Math.floor(Date.now() / 1000)): Promise<URL> {
  const params = { timestamp: String(now), public_id: publicId, format, type: 'authenticated', expires_at: String(now + 60) };
  const signature = await signCloudinary(params, env.CLOUDINARY_API_SECRET);
  const url = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/download`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('api_key', env.CLOUDINARY_API_KEY);
  url.searchParams.set('signature', signature);
  return url;
}

export async function uploadAuthenticated(bytes: Uint8Array, format: 'jpg' | 'png', publicId: string, env: CloudinaryEnv,
  transport: typeof fetch = fetch, overwrite = false): Promise<void> {
  const assetFolder = publicId.split('/')[0];
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(assetFolder)) throw new Error('Namespace Cloudinary invalide');
  const params = { asset_folder: assetFolder, public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'authenticated', overwrite: String(overwrite) };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set('api_key', env.CLOUDINARY_API_KEY);
  form.set('signature', await signCloudinary(params, env.CLOUDINARY_API_SECRET));
  const copy = new Uint8Array(bytes);
  form.set('file', new Blob([copy], { type: format === 'jpg' ? 'image/jpeg' : 'image/png' }), `receipt.${format}`);
  const response = await transport(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Upload Cloudinary refusé (${response.status})`);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object') throw new Error('Réponse Cloudinary invalide');
  const data = result as Record<string, unknown>;
  if (data['public_id'] !== publicId || data['type'] !== 'authenticated' || data['resource_type'] !== 'image' || data['format'] !== format) {
    throw new Error('Asset Cloudinary inattendu');
  }
}

export async function destroyAuthenticated(publicId: string, env: CloudinaryEnv, transport: typeof fetch = fetch): Promise<void> {
  const params = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'authenticated', invalidate: 'true' };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set('api_key', env.CLOUDINARY_API_KEY);
  form.set('signature', await signCloudinary(params, env.CLOUDINARY_API_SECRET));
  const response = await transport(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/destroy`, { method: 'POST', body: form });
  if (!response.ok) throw new Error('Suppression Cloudinary refusée');
  const result = await response.json() as { result?: string };
  if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Suppression Cloudinary non confirmée');
}
