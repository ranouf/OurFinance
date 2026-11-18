import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { LanguageService } from '../../src/app/core/language/language-service';
import { ProfileService, type ProfilePreferences, type ProfileRepository } from '../../src/app/core/firebase/profile-service';

const app = {} as FirebaseApp;
const profile: ProfilePreferences = { displayName: 'Aline', preferredLanguage: 'ja', timeZone: 'America/Toronto' };

test('LanguageService shares active language, locale and messages with every page', () => {
  const service = new LanguageService();
  const previous = service.current();
  try {
    strictEqual(service.detect(['es-ES', 'ja-JP']), 'ja');
    service.use('ja');
    strictEqual(service.current(), 'ja');
    strictEqual(service.locale(), 'ja-JP');
    strictEqual(service.translate('myGroups'), 'マイグループ');
    throws(() => service.use('xx' as 'fr'));
  } finally { service.use(previous); }
});

function fixture(data: Record<string, unknown> = profile) {
  const calls: string[] = [];
  const repository: ProfileRepository = {
    read: async (_app, uid) => { calls.push(`read:${uid}`); return data; },
    updateName: async (_user, name) => { calls.push(`name:${name}`); },
    write: async (_app, uid, value) => { calls.push(`write:${uid}:${value.preferredLanguage}`); },
  };
  class RecordedLanguage extends LanguageService {
    override detect(): 'en' { calls.push('detect'); return 'en'; }
    override use(value: 'fr' | 'en' | 'ja'): void { calls.push(`language:${value}`); }
  }
  return { calls, repository, language: new RecordedLanguage(), user: {
    uid: 'account-user', displayName: 'Fallback', emailVerified: true,
  } as User };
}

test('ProfileService loads persisted preferences and falls back for missing values', async () => {
  const saved = fixture();
  const service = new ProfileService(app, saved.repository, saved.language);
  deepStrictEqual(await service.load(saved.user), profile);
  deepStrictEqual(saved.calls, ['read:account-user']);

  const missing = fixture({ preferredLanguage: 'unsupported', timeZone: 'invalid' });
  const fallback = await new ProfileService(app, missing.repository, missing.language).load(missing.user);
  strictEqual(fallback.displayName, 'Fallback');
  strictEqual(fallback.preferredLanguage, 'en');
  strictEqual(Intl.supportedValuesOf('timeZone').includes(fallback.timeZone), true);
  deepStrictEqual(missing.calls, ['read:account-user', 'detect']);
});

test('ProfileService validates, writes the account and applies its saved language in order', async () => {
  const f = fixture();
  const service = new ProfileService(app, f.repository, f.language);
  await service.save(f.user, { ...profile, displayName: '  Aline  ' });
  deepStrictEqual(f.calls, ['name:Aline', 'write:account-user:ja', 'language:ja']);
});

test('ProfileService rejects unverified or invalid input before a write and leaves language unchanged on failure', async () => {
  const f = fixture();
  const service = new ProfileService(app, f.repository, f.language);
  await rejects(service.save({ ...f.user, emailVerified: false } as User, profile));
  await rejects(service.save(f.user, { ...profile, displayName: ' ' }));
  deepStrictEqual(f.calls, []);
  f.repository.write = async () => { throw new Error('Firestore unavailable'); };
  await rejects(service.save(f.user, profile), /Firestore unavailable/);
  deepStrictEqual(f.calls, ['name:Aline']);
});
