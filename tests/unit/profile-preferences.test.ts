import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProfilePreferences } from '../../src/app/core/firebase/profile-service';

test('profile preferences keep an exact ISO currency and a supported time zone', () => {
  assert.deepEqual(validateProfilePreferences({ displayName: '  Alex Exemple  ', locale: 'fr-CA',
    referenceCurrency: 'CAD', timeZone: 'America/Toronto' }), {
    displayName: 'Alex Exemple', locale: 'fr-CA', referenceCurrency: 'CAD', timeZone: 'America/Toronto',
  });
  assert.equal(validateProfilePreferences({ displayName: 'Camille', locale: 'fr-FR',
    referenceCurrency: 'JPY', timeZone: 'Europe/Paris' }).referenceCurrency, 'JPY');
});

test('profile preferences refuse empty names, unsupported currencies and time zones', () => {
  const base = { displayName: 'Alex', locale: 'fr-CA' as const, referenceCurrency: 'CAD', timeZone: 'America/Toronto' };
  assert.throws(() => validateProfilePreferences({ ...base, displayName: ' ' }));
  assert.throws(() => validateProfilePreferences({ ...base, referenceCurrency: 'XYZ' }));
  assert.throws(() => validateProfilePreferences({ ...base, timeZone: 'Nowhere/Unknown' }));
});
