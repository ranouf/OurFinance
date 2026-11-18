import { signal } from '@angular/core';
import {
  Auth, GoogleAuthProvider, User, createUserWithEmailAndPassword,
  onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';

/** Firebase boundary kept injectable so every authentication path can be checked without real accounts. */
export interface AuthOperations {
  observe(auth: Auth, next: (user: User | null) => void): () => void;
  register(auth: Auth, email: string, password: string): Promise<User>;
  login(auth: Auth, email: string, password: string): Promise<unknown>;
  loginWithGoogle(auth: Auth): Promise<unknown>;
  sendVerification(user: User): Promise<void>;
  sendReset(auth: Auth, email: string): Promise<void>;
  logout(auth: Auth): Promise<void>;
}

const firebaseOperations: AuthOperations = {
  observe: (auth, next) => onAuthStateChanged(auth, next),
  register: async (auth, email, password) => (await createUserWithEmailAndPassword(auth, email, password)).user,
  login: (auth, email, password) => signInWithEmailAndPassword(auth, email, password),
  loginWithGoogle: auth => signInWithPopup(auth, new GoogleAuthProvider()),
  sendVerification: user => sendEmailVerification(user),
  sendReset: (auth, email) => sendPasswordResetEmail(auth, email),
  logout: auth => signOut(auth),
};

export class AuthService {
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  private readonly unsubscribe: () => void;

  constructor(private readonly auth: Auth, private readonly operations: AuthOperations = firebaseOperations) {
    this.unsubscribe = operations.observe(auth, user => {
      this.user.set(user);
      this.ready.set(true);
    });
  }

  async register(email: string, password: string): Promise<void> {
    const user = await this.operations.register(this.auth, email, password);
    await this.operations.sendVerification(user);
  }

  async login(email: string, password: string): Promise<void> {
    await this.operations.login(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    await this.operations.loginWithGoogle(this.auth);
  }

  async resetPassword(email: string): Promise<void> {
    await this.operations.sendReset(this.auth, email);
  }

  async refreshVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    this.user.set(null);
    this.user.set(this.auth.currentUser);
  }

  async resendVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || user.emailVerified) return;
    await this.operations.sendVerification(user);
  }

  async logout(): Promise<void> {
    await this.operations.logout(this.auth);
  }

  destroy(): void { this.unsubscribe(); }
}
