import { signal } from '@angular/core';
import {
  Auth, GoogleAuthProvider, User, createUserWithEmailAndPassword,
  onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';

export class AuthService {
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  private readonly unsubscribe: () => void;

  constructor(private readonly auth: Auth) {
    this.unsubscribe = onAuthStateChanged(auth, user => {
      this.user.set(user);
      this.ready.set(true);
    });
  }

  async register(email: string, password: string): Promise<void> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    await sendEmailVerification(result.user);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
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
    await sendEmailVerification(user);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  destroy(): void { this.unsubscribe(); }
}
