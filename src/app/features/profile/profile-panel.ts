import { ChangeDetectorRef, Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { ProfileService, type ProfilePreferences } from '../../core/firebase/profile-service';
import { setLanguage, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-profile-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Mon profil">
      <h2 class="text-lg font-semibold">{{ t('myProfile') }}</h2>
      <p class="mt-1 text-sm text-slate-600">{{ t('profileIntro') }}</p>
      @if (loading()) { <p class="mt-3 text-sm text-slate-600" role="status">{{ t('loadingProfile') }}</p> }
      @else {
        <form class="mt-4 space-y-4" (ngSubmit)="save()">
          <label class="block text-sm font-medium">{{ t('displayName') }}
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileName" [(ngModel)]="displayName" maxlength="80" required />
          </label>
          <label class="block text-sm font-medium">{{ t('language') }}
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileLanguage" [(ngModel)]="preferredLanguage" (ngModelChange)="applyLanguage()">
              <option value="fr">Français</option><option value="en">English</option><option value="ja">日本語</option>
            </select>
          </label>
          <label class="block text-sm font-medium">{{ t('timeZone') }}
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="profileZone" [(ngModel)]="timeZone" list="profile-zones" required />
            <datalist id="profile-zones">@for (zone of zones; track zone) { <option [value]="zone"></option> }</datalist>
          </label>
          <button class="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" [disabled]="busy() || !user?.emailVerified">{{ t('saveProfile') }}</button>
        </form>
        <div class="mt-5 border-t border-slate-200 pt-4">
          <h3 class="font-semibold">{{ t('signInMethods') }}</h3>
          @if (googleLinked()) { <p class="mt-2 text-sm text-slate-600">{{ t('googleLinked') }}</p> }
          @else {
            <button class="mt-2 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button"
              [disabled]="busy() || !user?.emailVerified" (click)="linkGoogle()">{{ t('linkGoogle') }}</button>
          }
        </div>
      }
      @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ProfilePanel implements OnChanges {
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  readonly zones = Intl.supportedValuesOf('timeZone');
  readonly loading = signal(true);
  readonly t = t;
  readonly busy = signal(false);
  readonly message = signal('');
  displayName = ''; preferredLanguage: ProfilePreferences['preferredLanguage'] = 'en'; timeZone = 'America/Toronto';
  private service?: ProfileService;
  private loadedUid?: string;
  private requestId = 0;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}
  googleLinked(): boolean { return this.user?.providerData.some(provider => provider.providerId === 'google.com') ?? false; }
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
      this.displayName = value.displayName; this.preferredLanguage = value.preferredLanguage; this.timeZone = value.timeZone;
      this.applyLanguage();
    } catch { if (requestId === this.requestId) this.message.set(t('profileUnavailable')); }
    finally { if (requestId === this.requestId) { this.loading.set(false); this.changeDetector.markForCheck(); } }
  }
  async save(): Promise<void> {
    const user = this.user;
    if (!user || !this.service || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      await this.service.save(user, { displayName: this.displayName, preferredLanguage: this.preferredLanguage, timeZone: this.timeZone });
      this.message.set(t('profileSaved'));
    } catch (error) { this.message.set(error instanceof Error && error.message === 'Préférences de profil invalides' ? error.message : t('profileSaveFailed')); }
    finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
  applyLanguage(): void {
    setLanguage(this.preferredLanguage);
  }
  async linkGoogle(): Promise<void> {
    const user = this.user;
    if (!user?.emailVerified || this.busy() || this.googleLinked()) return;
    this.busy.set(true); this.message.set('');
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
      this.message.set(t('googleLinkDone'));
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      this.message.set(code === 'auth/credential-already-in-use' ? t('googleInUse') : t('googleLinkFailed'));
    } finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
}
