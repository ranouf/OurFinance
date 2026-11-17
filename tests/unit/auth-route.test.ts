import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { authDestination } from '../../src/app/core/firebase/auth-route';

test('a persisted session is not redirected while Firebase Auth initializes', () => {
  strictEqual(authDestination(false, '/dashboard', null, false), null);
  strictEqual(authDestination(false, '/expenses', null, true), null);
  strictEqual(authDestination(false, '/login', { emailVerified: true }, false), null);
});

test('navigation starts only after the session resolves', () => {
  strictEqual(authDestination(true, '/dashboard', null, false), '/login');
  strictEqual(authDestination(true, '/expenses', { emailVerified: false }, false), '/login');
  strictEqual(authDestination(true, '/login', { emailVerified: true }, false), '/dashboard');
  strictEqual(authDestination(true, '/dashboard', { emailVerified: true }, true), '/join');
  strictEqual(authDestination(true, '/dashboard', { emailVerified: true }, false), null);
});
