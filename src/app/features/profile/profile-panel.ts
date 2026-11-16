import { ChangeDetectorRef, Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ProfileService, type ProfilePreferences } from '../../core/firebase/profile-service';
import { currencyCodes } from '../../shared/utils/currency';

@Component({
  selector: 'app-profile-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Mon profil">
      <h2 class="text-lg font-semibold">Mon profil</h2>
      <p class="mt-1 text-sm text-slate-600">Ces réglages sont personnels ; ils ne modifient pas les dépenses ni les devises des groupes.</p>
      @if (loading()) { <p class="mt-3 text-sm text-slate-600" role="status">Chargement du profil…</p> }
      @else {
        <form class="mt-4 space-y-4" (ngSubmit)="save()">
          <label class="block text-sm font-medium">Nom affiché
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileName" [(ngModel)]="displayName" maxlength="80" required />
          </label>
          <label class="block text-sm font-medium">Langue
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileLocale" [(ngModel)]="locale">
              <option value="fr-CA">Français (Canada)</option><option value="en-CA">English (Canada)</option>
              <option value="fr-FR">Français (France)</option><option value="en-US">English (United States)</option>
            </select>
          </label>
          <label class="block text-sm font-medium">Devise de référence
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileCurrency" [(ngModel)]="referenceCurrency">
              @for (code of currencies; track code) { <option [value]="code">{{ code }}</option> }
            </select>
          </label>
          <label class="block text-sm font-medium">Fuseau horaire
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileZone" [(ngModel)]="timeZone" list="profile-zones" required />
            <datalist id="profile-zones">@for (zone of zones; track zone) { <option [value]="zone"></option> }</datalist>
          </label>
          <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" [disabled]="busy() || !user?.emailVerified">Enregistrer le profil</button>
        </form>
      }
      @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ProfilePanel implements OnChanges {
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  readonly currencies = currencyCodes();
  readonly zones = Intl.supportedValuesOf('timeZone');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly message = signal('');
  displayName = ''; locale: ProfilePreferences['locale'] = 'fr-CA'; referenceCurrency = 'CAD'; timeZone = 'America/Toronto';
  private service?: ProfileService;
  private loadedUid?: string;
  private requestId = 0;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  ngOnChanges(): void {
    if (!this.firebaseApp || !this.user) return;
    this.service = new ProfileService(this.firebaseApp);
    if (this.loadedUid !== this.user.uid) { this.loadedUid = this.user.uid; void this.load(this.user); }
  }
  private async load(user: User): Promise<void> {
    const requestId = ++this.requestId;
    this.loading.set(true); this.message.set('');
    try {
      const value = await this.service!.load(user);
      if (requestId !== this.requestId || this.user?.uid !== user.uid) return;
      this.displayName = value.displayName; this.locale = value.locale;
      this.referenceCurrency = value.referenceCurrency; this.timeZone = value.timeZone;
    } catch { if (requestId === this.requestId) this.message.set('Profil indisponible.'); }
    finally { if (requestId === this.requestId) { this.loading.set(false); this.changeDetector.markForCheck(); } }
  }
  async save(): Promise<void> {
    const user = this.user;
    if (!user || !this.service || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      await this.service.save(user, { displayName: this.displayName, locale: this.locale,
        referenceCurrency: this.referenceCurrency, timeZone: this.timeZone });
      this.message.set('Profil enregistré.');
    } catch (error) { this.message.set(error instanceof Error && error.message === 'Préférences de profil invalides' ? error.message : 'Enregistrement du profil impossible.'); }
    finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
}
