import assert from 'node:assert/strict';
import test from 'node:test';
import { detectLanguage, validateProfilePreferences } from '../../src/app/core/firebase/profile-service';

test('profile preferences keep a supported language and time zone without a personal currency', () => {
  assert.deepEqual(validateProfilePreferences({ displayName: '  Alex Exemple  ', preferredLanguage: 'fr',
    timeZone: 'America/Toronto' }), {
    displayName: 'Alex Exemple', preferredLanguage: 'fr', timeZone: 'America/Toronto',
  });
  assert.equal(validateProfilePreferences({ displayName: 'Camille', preferredLanguage: 'ja',
    timeZone: 'Asia/Tokyo' }).preferredLanguage, 'ja');
});

test('profile preferences refuse empty names, unsupported languages and time zones', () => {
  const base = { displayName: 'Alex', preferredLanguage: 'fr' as const, timeZone: 'America/Toronto' };
  assert.throws(() => validateProfilePreferences({ ...base, displayName: ' ' }));
  assert.throws(() => validateProfilePreferences({ ...base, preferredLanguage: 'es' as 'fr' }));
  assert.throws(() => validateProfilePreferences({ ...base, timeZone: 'Nowhere/Unknown' }));
});

test('browser language detection supports fr-CA, en-US, ja-JP and English fallback', () => {
  assert.equal(detectLanguage(['fr-CA']), 'fr');
  assert.equal(detectLanguage(['en-US']), 'en');
  assert.equal(detectLanguage(['ja-JP']), 'ja');
  assert.equal(detectLanguage(['es-ES', 'ja-JP']), 'ja');
  assert.equal(detectLanguage(['es-ES']), 'en');
});
