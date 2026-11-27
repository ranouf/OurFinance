import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const limits = Object.freeze({
  firestoreReads: { max: 50_000, period: 'jour Pacific', unit: 'lectures' },
  firestoreWrites: { max: 20_000, period: 'jour Pacific', unit: 'écritures' },
  firestoreDeletes: { max: 20_000, period: 'jour Pacific', unit: 'suppressions' },
  firestoreStorageBytes: { max: 1_073_741_824, period: 'instantané', unit: 'octets' },
  firestoreEgressBytes: { max: 10_737_418_240, period: 'mois', unit: 'octets' },
  cloudflareAccountRequests: { max: 100_000, period: 'jour UTC', unit: 'requêtes' },
  cloudinaryCredits: { max: 25, period: '30 jours glissants', unit: 'crédits' },
});

export function evaluateQuotaSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Relevé JSON attendu');
  const unknown = Object.keys(snapshot).filter(key => key !== 'recordedAt' && !(key in limits));
  if (unknown.length) throw new Error('Champ de relevé inconnu');
  if (Number.isNaN(Date.parse(snapshot.recordedAt)) || !/Z$/.test(snapshot.recordedAt ?? '')) {
    throw new Error('recordedAt doit être une date UTC');
  }
  return Object.entries(limits).map(([key, limit]) => {
    const value = snapshot[key];
    if (value === undefined || value === null) return { key, state: 'missing', ...limit };
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        (key !== 'cloudinaryCredits' && !Number.isInteger(value))) {
      throw new Error(`Valeur agrégée invalide pour ${key}`);
    }
    const percent = Math.round(value / limit.max * 10_000) / 100;
    const ratio = value / limit.max;
    return { key, value, percent, state: ratio >= 0.9 ? 'intervention' : ratio >= 0.7 ? 'warning' : 'ok', ...limit };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = evaluateQuotaSnapshot(snapshot);
    for (const row of result) {
      console.log(`${row.key}: ${row.state}${row.value === undefined ? '' : ` ${row.value}/${row.max} ${row.unit} (${row.percent} %) — ${row.period}`}`);
    }
    if (result.some(row => row.state === 'intervention')) process.exitCode = 1;
    else if (result.some(row => row.state === 'missing')) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
