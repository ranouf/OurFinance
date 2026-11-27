import { writeFileSync } from 'node:fs';

// Configuration réservée aux émulateurs; le fichier généré est ignoré par Git.
writeFileSync('public/app-config.json', JSON.stringify({
  projectId: 'ourfinance-test', apiKey: 'demo', appId: 'demo', authDomain: 'localhost',
  workerUrl: 'https://worker.invalid',
}), { mode: 0o600 });
