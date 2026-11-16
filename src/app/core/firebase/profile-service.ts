import type { FirebaseApp } from 'firebase/app';
import { updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { currencyCodes } from '../../shared/utils/currency';

export interface ProfilePreferences {
  readonly displayName: string;
  readonly locale: 'fr-CA' | 'en-CA' | 'fr-FR' | 'en-US';
  readonly referenceCurrency: string;
  readonly timeZone: string;
}
const locales = ['fr-CA', 'en-CA', 'fr-FR', 'en-US'];

export function validateProfilePreferences(input: ProfilePreferences): ProfilePreferences {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80 || !locales.includes(input.locale) ||
      !currencyCodes().includes(input.referenceCurrency) ||
      !Intl.supportedValuesOf('timeZone').includes(input.timeZone)) throw new Error('Préférences de profil invalides');
  return { displayName, locale: input.locale, referenceCurrency: input.referenceCurrency, timeZone: input.timeZone };
}

export class ProfileService {
  constructor(private readonly app: FirebaseApp) {}

  async load(user: User): Promise<ProfilePreferences> {
    const snapshot = await getDoc(doc(getFirestore(this.app), 'users', user.uid));
    const data = snapshot.data() ?? {};
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      displayName: typeof data['displayName'] === 'string' ? data['displayName'] : user.displayName ?? '',
      locale: locales.includes(String(data['locale'])) ? data['locale'] as ProfilePreferences['locale'] : 'fr-CA',
      referenceCurrency: typeof data['referenceCurrency'] === 'string' && currencyCodes().includes(data['referenceCurrency']) ? data['referenceCurrency'] : 'CAD',
      timeZone: typeof data['timeZone'] === 'string' && Intl.supportedValuesOf('timeZone').includes(data['timeZone']) ? data['timeZone'] :
        Intl.supportedValuesOf('timeZone').includes(zone) ? zone : 'America/Toronto',
    };
  }

  async save(user: User, input: ProfilePreferences): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const value = validateProfilePreferences(input);
    await updateProfile(user, { displayName: value.displayName });
    await setDoc(doc(getFirestore(this.app), 'users', user.uid), value, { merge: true });
  }
}
