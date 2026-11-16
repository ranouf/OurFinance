import { Component, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getAuth } from 'firebase/auth';
import { AppShell } from './shared/components/app-shell/app-shell';
import { AuthService } from './core/firebase/auth-service';
import { FirebaseWebConfig, createFirebaseApp } from './core/firebase/firebase-config';
import type { GroupService } from './core/firebase/group-service';
import type { FirebaseApp } from 'firebase/app';
import { currencyCodes } from './shared/utils/currency';
import { Group } from './core/firebase/group-model';
import { ExpenseForm } from './features/expenses/expense-form';
import { ExpenseHistory } from './features/expenses/expense-history';
import { SettlementForm } from './features/settlements/settlement-form';

@Component({
  selector: 'app-root',
  imports: [AppShell, FormsModule, ExpenseForm, ExpenseHistory, SettlementForm],
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
            <section class="mt-6" aria-label="Mes groupes">
              <h2 class="text-lg font-semibold">Mes groupes</h2>
              @if (groups().length) {
                <ul class="mt-3 space-y-2">
                  @for (group of groups(); track group.id) {
                    <li class="rounded-lg border border-slate-200 p-3">{{ group.name }} · {{ group.currency }}</li>
                  }
                </ul>
              } @else { <p class="mt-2 text-slate-600">Aucun groupe disponible.</p> }
              @if (groupServiceReady()) {
                <form class="mt-5 space-y-3" (ngSubmit)="createGroup()">
                  <label class="block text-sm">Nom du groupe
                    <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="groupName" [(ngModel)]="groupName" maxlength="80" required />
                  </label>
                  <label class="block text-sm">Devise proposée
                    <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="groupCurrency" [(ngModel)]="groupCurrency">
                      @for (currency of currencies; track currency) { <option [value]="currency">{{ currency }}</option> }
                    </select>
                  </label>
                  <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="submit" [disabled]="busy()">Créer un groupe</button>
                </form>
              } @else { <p class="mt-4 text-sm text-amber-800">Le service de création de groupes n’est pas encore configuré.</p> }
            </section>
            @if (workerUrl && firebaseApp && groups().length) {
              <app-expense-form [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" (saved)="onExpenseSaved()" />
              <app-expense-history [groups]="groups()" [firebaseApp]="firebaseApp" [user]="user" [workerUrl]="workerUrl" [revision]="expenseRevision()" />
              <app-settlement-form [groups]="groups()" [user]="user" [firebaseApp]="firebaseApp" [workerUrl]="workerUrl" />
            }
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
  private groupService?: GroupService;
  firebaseApp?: FirebaseApp;
  workerUrl?: string;
  readonly currencies = currencyCodes();
  readonly groups = signal<Group[]>([]);
  readonly expenseRevision = signal(0);
  readonly groupServiceReady = signal(false);
  groupName = '';
  groupCurrency = 'CAD';

  constructor() {
    effect(() => {
      if (this.state() === 'ready') {
        const user = this.auth?.user();
        if (user?.emailVerified) void this.loadGroups();
      }
    });
  }
  email = '';
  password = '';
  readonly heading = () => this.mode() === 'register' ? 'Créer un compte' : this.mode() === 'reset' ? 'Réinitialiser le mot de passe' : 'Bienvenue';

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration absente');
      const config = await response.json() as FirebaseWebConfig;
      if (config.projectId !== 'ourfinance-test') throw new Error('Projet non autorisé');
      const firebaseApp = createFirebaseApp(config);
      this.auth = new AuthService(getAuth(firebaseApp));
      this.firebaseApp = firebaseApp;
      this.workerUrl = config.workerUrl;
      this.groupServiceReady.set(!!config.workerUrl);
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
  private async loadGroups(): Promise<void> {
    const user = this.auth?.user();
    if (!user || !this.firebaseApp) return;
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      this.groups.set(await this.groupService.list(user));
    }
    catch { this.message.set('Liste des groupes indisponible.'); }
  }
  async createGroup(): Promise<void> {
    const user = this.auth?.user();
    if (!user || !this.firebaseApp || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      if (!this.groupService) { const { GroupService } = await import('./core/firebase/group-service'); this.groupService = new GroupService(this.firebaseApp, this.workerUrl); }
      await this.groupService.create(user, this.groupName, this.groupCurrency); this.groupName = ''; await this.loadGroups(); }
    catch { this.message.set('Création du groupe impossible.'); }
    finally { this.busy.set(false); }
  }
  async logout(): Promise<void> { this.groups.set([]); await this.auth?.logout(); }
  onExpenseSaved(): void { this.expenseRevision.update(value => value + 1); }
}
