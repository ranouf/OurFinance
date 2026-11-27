import { readFileSync, writeFileSync } from 'node:fs';

// Configuration réservée aux émulateurs; le fichier généré est ignoré par Git.
writeFileSync('public/app-config.json', JSON.stringify({
  projectId: 'ourfinance-test', apiKey: 'demo', appId: 'demo', authDomain: 'localhost',
  workerUrl: 'https://worker.invalid',
}), { mode: 0o600 });

// Le build conserve la CSP de production. Seul Hosting émulateur autorise
// les deux ports locaux nécessaires au scénario PWA.
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
for (const entry of firebase.hosting.headers ?? []) {
  for (const header of entry.headers ?? []) {
    if (header.key !== 'Content-Security-Policy') continue;
    header.value = header.value.replace(
      "connect-src 'self'",
      "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080",
    );
  }
}
writeFileSync('firebase.pwa.json', JSON.stringify(firebase), { mode: 0o600 });
