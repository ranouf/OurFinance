import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getAuth } from 'firebase/auth';
import { AppShell } from './shared/components/app-shell/app-shell';
import { AuthService } from './core/firebase/auth-service';
import { FirebaseWebConfig, createFirebaseApp } from './core/firebase/firebase-config';

@Component({
  selector: 'app-root',
  imports: [AppShell, FormsModule],
  template: `
    <app-shell>
      <div class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 class="text-2xl font-bold">{{ heading() }}</h1>
        @if (state() === 'loading') {
          <p class="mt-4 text-slate-600" role="status">Chargement de la configuration…</p>
        } @else if (state() === 'unconfigured') {
          <p class="mt-4 text-slate-600" role="status">L’environnement Firebase de test n’est pas configuré sur ce site.</p>
        } @else if (auth?.user(); as user) {
          <p class="mt-4 text-slate-600">Connecté en tant que {{ user.email }}.</p>
          @if (!user.emailVerified) {
            <p class="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900" role="status">Confirmez votre adresse courriel avant d’utiliser les groupes.</p>
          } @else {
            <p class="mt-4 rounded-lg bg-teal-50 p-3 text-teal-900" role="status">Compte vérifié. Les groupes et dépenses seront disponibles après l’intégration des transactions sécurisées.</p>
          }
          <button class="mt-6 rounded-lg border border-slate-300 px-4 py-2" type="button" (click)="logout()">Déconnexion</button>
        } @else {
          <p class="mt-3 text-slate-600">Accédez à votre espace de test.</p>
          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <label class="block text-sm font-medium">Adresse courriel
              <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="email" name="email" autocomplete="email" [(ngModel)]="email" required />
            </label>
            @if (mode() !== 'reset') {
              <label class="block text-sm font-medium">Mot de passe
                <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />
              </label>
            }
            <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" [disabled]="busy()" type="submit">
              {{ mode() === 'register' ? 'Créer un compte' : mode() === 'reset' ? 'Envoyer le lien' : 'Se connecter' }}
            </button>
          </form>
          @if (mode() === 'login') {
            <button class="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3" type="button" [disabled]="busy()" (click)="google()">Continuer avec Google</button>
          }
          <div class="mt-5 flex gap-4 text-sm text-teal-700">
            <button type="button" (click)="mode.set('login')">Connexion</button>
            <button type="button" (click)="mode.set('register')">Inscription</button>
            <button type="button" (click)="mode.set('reset')">Mot de passe oublié</button>
          </div>
        }
        @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
      </div>
    </app-shell>
  `,
})
export class App implements OnInit, OnDestroy {
  readonly state = signal<'loading' | 'unconfigured' | 'ready'>('loading');
  readonly mode = signal<'login' | 'register' | 'reset'>('login');
  readonly busy = signal(false);
  readonly message = signal('');
  auth?: AuthService;
  email = '';
  password = '';
  readonly heading = () => this.mode() === 'register' ? 'Créer un compte' : this.mode() === 'reset' ? 'Réinitialiser le mot de passe' : 'Bienvenue';

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration absente');
      const config = await response.json() as FirebaseWebConfig;
      if (config.projectId !== 'ourfinance-test') throw new Error('Projet non autorisé');
      this.auth = new AuthService(getAuth(createFirebaseApp(config)));
      this.state.set('ready');
    } catch { this.state.set('unconfigured'); }
  }
  ngOnDestroy(): void { this.auth?.destroy(); }
  async submit(): Promise<void> {
    if (!this.auth || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      if (this.mode() === 'register') { await this.auth.register(this.email, this.password); this.message.set('Courriel de vérification envoyé.'); }
      else if (this.mode() === 'reset') { await this.auth.resetPassword(this.email); this.message.set('Si ce compte existe, un courriel sera envoyé.'); }
      else await this.auth.login(this.email, this.password);
    } catch { this.message.set('Action impossible. Vérifiez les données saisies ou réessayez plus tard.'); }
    finally { this.busy.set(false); }
  }
  async google(): Promise<void> {
    if (!this.auth || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await this.auth.loginWithGoogle(); }
    catch { this.message.set('Connexion Google impossible.'); }
    finally { this.busy.set(false); }
  }
  async logout(): Promise<void> { await this.auth?.logout(); }
}
