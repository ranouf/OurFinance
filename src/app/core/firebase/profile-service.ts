import type { FirebaseApp } from 'firebase/app';
import { updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import type { Language } from '../../shared/utils/i18n';
import { LanguageService } from '../language/language-service';

export interface ProfilePreferences {
  readonly displayName: string;
  readonly preferredLanguage: Language;
  readonly timeZone: string;
}
const languages: readonly Language[] = ['fr', 'en', 'ja'];

export interface ProfileRepository {
  read(app: FirebaseApp, uid: string): Promise<Record<string, unknown>>;
  updateName(user: User, displayName: string): Promise<void>;
  write(app: FirebaseApp, uid: string, value: ProfilePreferences): Promise<void>;
}
const firebaseProfileRepository: ProfileRepository = {
  read: async (app, uid) => (await getDoc(doc(getFirestore(app), 'users', uid))).data() ?? {},
  updateName: (user, displayName) => updateProfile(user, { displayName }),
  write: (app, uid, value) => setDoc(doc(getFirestore(app), 'users', uid), value),
};

export function validateProfilePreferences(input: ProfilePreferences): ProfilePreferences {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80 || !languages.includes(input.preferredLanguage) ||
      !Intl.supportedValuesOf('timeZone').includes(input.timeZone)) throw new Error('Préférences de profil invalides');
  return { displayName, preferredLanguage: input.preferredLanguage, timeZone: input.timeZone };
}

export class ProfileService {
  constructor(
    private readonly app: FirebaseApp,
    private readonly repository: ProfileRepository = firebaseProfileRepository,
    private readonly languages = new LanguageService(),
  ) {}

  async load(user: User): Promise<ProfilePreferences> {
    const data = await this.repository.read(this.app, user.uid);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      displayName: typeof data['displayName'] === 'string' ? data['displayName'] : user.displayName ?? '',
      preferredLanguage: languages.includes(data['preferredLanguage'] as Language) ? data['preferredLanguage'] as Language :
        this.languages.detect(typeof navigator === 'undefined' ? [] : navigator.languages),
      timeZone: typeof data['timeZone'] === 'string' && Intl.supportedValuesOf('timeZone').includes(data['timeZone']) ? data['timeZone'] :
        Intl.supportedValuesOf('timeZone').includes(zone) ? zone : 'America/Toronto',
    };
  }

  async save(user: User, input: ProfilePreferences): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const value = validateProfilePreferences(input);
    await this.repository.updateName(user, value.displayName);
    await this.repository.write(this.app, user.uid, value);
    this.languages.use(value.preferredLanguage);
  }
}
