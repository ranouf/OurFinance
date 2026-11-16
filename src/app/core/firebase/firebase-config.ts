import { FirebaseApp, initializeApp } from 'firebase/app';

/** Public Firebase web identifiers only. Never place service account credentials here. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  workerUrl?: string;
}

export function createFirebaseApp(config: FirebaseWebConfig): FirebaseApp {
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Configuration Firebase web incomplète');
  }
  return initializeApp(config);
}
