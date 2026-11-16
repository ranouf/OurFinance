import type { FirebaseApp } from 'firebase/app';
import { updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

export type Language = 'fr' | 'en' | 'ja';

export function detectLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'fr' || primary === 'en' || primary === 'ja') return primary;
  }
  return 'en';
}

export interface ProfilePreferences {
  readonly displayName: string;
  readonly preferredLanguage: Language;
  readonly timeZone: string;
}
const languages: readonly Language[] = ['fr', 'en', 'ja'];

export function validateProfilePreferences(input: ProfilePreferences): ProfilePreferences {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80 || !languages.includes(input.preferredLanguage) ||
      !Intl.supportedValuesOf('timeZone').includes(input.timeZone)) throw new Error('Préférences de profil invalides');
  return { displayName, preferredLanguage: input.preferredLanguage, timeZone: input.timeZone };
}

export class ProfileService {
  constructor(private readonly app: FirebaseApp) {}

  async load(user: User): Promise<ProfilePreferences> {
    const snapshot = await getDoc(doc(getFirestore(this.app), 'users', user.uid));
    const data = snapshot.data() ?? {};
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      displayName: typeof data['displayName'] === 'string' ? data['displayName'] : user.displayName ?? '',
      preferredLanguage: languages.includes(data['preferredLanguage'] as Language) ? data['preferredLanguage'] as Language :
        detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages),
      timeZone: typeof data['timeZone'] === 'string' && Intl.supportedValuesOf('timeZone').includes(data['timeZone']) ? data['timeZone'] :
        Intl.supportedValuesOf('timeZone').includes(zone) ? zone : 'America/Toronto',
    };
  }

  async save(user: User, input: ProfilePreferences): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const value = validateProfilePreferences(input);
    await updateProfile(user, { displayName: value.displayName });
    await setDoc(doc(getFirestore(this.app), 'users', user.uid), value);
  }
}
