import { writeFileSync } from 'node:fs';
const config = {
  apiKey: process.env.TEST_FIREBASE_API_KEY,
  authDomain: process.env.TEST_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.TEST_FIREBASE_PROJECT_ID,
  appId: process.env.TEST_FIREBASE_APP_ID,
  workerUrl: process.env.TEST_WORKER_URL,
};
if (config.projectId !== 'ourfinance-test' || [config.apiKey, config.authDomain, config.projectId, config.appId].some(value => !value)) {
  throw new Error('Configuration Firebase de test incomplète ou projet incorrect');
}
writeFileSync('public/app-config.json', JSON.stringify(config), { mode: 0o600 });
