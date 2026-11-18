import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { Auth, User } from 'firebase/auth';
import { AuthService, type AuthOperations } from '../../src/app/core/firebase/auth-service';

function fixture() {
  const calls: string[] = [];
  const state = { currentUser: null as User | null };
  let notify: (user: User | null) => void = () => {};
  const auth = state as Auth;
  const registered = { emailVerified: false } as User;
  const operations: AuthOperations = {
    observe: (_auth, next) => {
      notify = next;
      return () => { calls.push('unsubscribe'); };
    },
    register: async (_auth, email, password) => { calls.push(`register:${email}:${password}`); return registered; },
    login: async (_auth, email, password) => { calls.push(`login:${email}:${password}`); },
    loginWithGoogle: async () => { calls.push('google'); },
    sendVerification: async user => { strictEqual(user, state.currentUser ?? registered); calls.push('verify'); },
    sendReset: async (_auth, email) => { calls.push(`reset:${email}`); },
    logout: async () => { calls.push('logout'); },
  };
  return { auth, state, calls, operations, emit: (user: User | null) => notify(user) };
}

test('session remains unknown until Firebase responds and unsubscribes on destroy', () => {
  const f = fixture();
  const service = new AuthService(f.auth, f.operations);
  strictEqual(service.ready(), false);
  strictEqual(service.user(), null);
  const user = { emailVerified: true } as User;
  f.emit(user);
  strictEqual(service.ready(), true);
  strictEqual(service.user(), user);
  f.emit(null);
  strictEqual(service.user(), null);
  service.destroy();
  deepStrictEqual(f.calls, ['unsubscribe']);
});

test('registration verifies the created user; login, Google, reset and logout use one auth boundary', async () => {
  const f = fixture();
  const service = new AuthService(f.auth, f.operations);
  await service.register('test@example.invalid', 'secret');
  await service.login('test@example.invalid', 'secret');
  await service.loginWithGoogle();
  await service.resetPassword('test@example.invalid');
  await service.logout();
  deepStrictEqual(f.calls, [
    'register:test@example.invalid:secret', 'verify', 'login:test@example.invalid:secret',
    'google', 'reset:test@example.invalid', 'logout',
  ]);
  service.destroy();
});

test('failed registration does not send verification and surfaces the original error', async () => {
  const f = fixture();
  const failure = new Error('auth unavailable');
  f.operations.register = async () => { throw failure; };
  const service = new AuthService(f.auth, f.operations);
  await rejects(service.register('test@example.invalid', 'secret'), failure);
  deepStrictEqual(f.calls, []);
  service.destroy();
});

test('verification refresh handles absent, unverified and newly verified users', async () => {
  const f = fixture();
  const service = new AuthService(f.auth, f.operations);
  await service.refreshVerification();
  await service.resendVerification();
  deepStrictEqual(f.calls, []);

  const state = { emailVerified: false };
  const user = {
    get emailVerified() { return state.emailVerified; },
    reload: async () => { f.calls.push('reload'); },
    getIdToken: async (forceRefresh: boolean) => { f.calls.push(`token:${forceRefresh}`); return 'fixture'; },
  } as User;
  f.state.currentUser = user;
  await service.resendVerification();
  await service.refreshVerification();
  strictEqual(service.user(), user);
  deepStrictEqual(f.calls, ['verify', 'reload']);

  state.emailVerified = true;
  await service.resendVerification();
  await service.refreshVerification();
  deepStrictEqual(f.calls, ['verify', 'reload', 'reload', 'token:true']);
  service.destroy();
});
