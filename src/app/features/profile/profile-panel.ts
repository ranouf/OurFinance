import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent, type DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { ChangeDetectorRef, Component, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { ProfileService, type ProfilePreferences } from '../../core/firebase/profile-service';
import { setLanguage, t, type MessageKey } from '../../shared/utils/i18n';

@Component({
  selector: 'app-profile-panel',
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section [attr.aria-label]="t('myProfile')">
      <div class="relative min-h-40 overflow-hidden rounded-[1.7rem] bg-pop-primary p-6 text-white shadow-[0_12px_30px_#6455ec30] sm:min-h-48 sm:p-8">
        <div class="relative z-10 max-w-[63%] sm:max-w-md">
          <h2 class="text-2xl font-black leading-tight sm:text-3xl">{{ t('myProfile') }}</h2>
          <p class="mt-2 text-sm font-medium text-white/90 sm:text-base">{{ t('profileIntro') }}</p>
        </div>
        <img class="pointer-events-none absolute -bottom-5 -right-8 h-40 w-40 object-contain sm:-bottom-14 sm:right-2 sm:h-64 sm:w-64" src="/illustrations/profile-settings.webp" alt="" />
      </div>
      @if (loading()) { <app-ui-alert variant="info" class="mt-5">{{ t('loadingProfile') }}</app-ui-alert> }
      @else {
        <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-start">
          <form class="space-y-5 rounded-[1.5rem] border border-pop-border bg-white p-5 shadow-sm sm:p-7" (ngSubmit)="save()">
            <h3 class="text-lg font-black">{{ t('myProfile') }}</h3>
            <label class="block text-sm font-bold">{{ t('displayName') }}
              <input appUiControl class="mt-2 w-full" name="profileName" [(ngModel)]="displayName" maxlength="80" required />
            </label>
            <app-field class="block" controlId="profile-language" [label]="t('language')">
              <app-dropdown controlId="profile-language" name="profileLanguage" [options]="languageOptions" [(ngModel)]="preferredLanguage" (ngModelChange)="applyLanguage()" />
            </app-field>
            <label class="block text-sm font-bold">{{ t('timeZone') }}
              <input appUiControl class="mt-2 w-full" name="profileZone" [(ngModel)]="timeZone" list="profile-zones" required />
              <datalist id="profile-zones">@for (zone of zones; track zone) { <option [value]="zone"></option> }</datalist>
            </label>
            <app-ui-button variant="coral" [block]="true" size="lg" class="w-full" type="submit" [disabled]="busy() || !user?.emailVerified">{{ t('saveProfile') }}</app-ui-button>
          </form>
          <div class="rounded-[1.5rem] border border-pop-border bg-white p-5 shadow-sm sm:p-7">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pop-lavender text-2xl" aria-hidden="true">🔐</div>
            <h3 class="text-lg font-black">{{ t('signInMethods') }}</h3>
            @if (googleLinked()) { <p class="mt-2 text-sm text-pop-muted">{{ t('googleLinked') }}</p> }
            @else {
              <app-ui-button variant="outline" class="mt-4" type="button"
                [disabled]="busy() || !user?.emailVerified" (click)="linkGoogle()">{{ t('linkGoogle') }}</app-ui-button>
            }
          </div>
        </div>
      }
      @if (message(); as key) { <app-ui-alert [variant]="key === 'profileSaved' || key === 'googleLinkDone' ? 'success' : 'error'" class="mt-4">{{ t(key) }}</app-ui-alert> }
    </section>
  `,
})
export class ProfilePanel implements OnChanges {
  readonly languageOptions: DropdownOption[] = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  readonly zones = Intl.supportedValuesOf('timeZone');
  readonly loading = signal(true);
  readonly t = t;
  readonly busy = signal(false);
  readonly message = signal<MessageKey | null>(null);
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
    this.loading.set(true); this.message.set(null);
    try {
      const value = await this.service!.load(user);
      if (requestId !== this.requestId || this.user?.uid !== user.uid) return;
      this.displayName = value.displayName; this.preferredLanguage = value.preferredLanguage; this.timeZone = value.timeZone;
      this.applyLanguage();
    } catch { if (requestId === this.requestId) this.message.set('profileUnavailable'); }
    finally { if (requestId === this.requestId) { this.loading.set(false); this.changeDetector.markForCheck(); } }
  }
  async save(): Promise<void> {
    const user = this.user;
    if (!user || !this.service || this.busy()) return;
    this.busy.set(true); this.message.set(null);
    try {
      await this.service.save(user, { displayName: this.displayName, preferredLanguage: this.preferredLanguage, timeZone: this.timeZone });
      this.message.set('profileSaved');
    } catch (error) { this.message.set(error instanceof Error && error.message === 'Préférences de profil invalides' ? 'profileInvalid' : 'profileSaveFailed'); }
    finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
  applyLanguage(): void {
    setLanguage(this.preferredLanguage);
  }
  async linkGoogle(): Promise<void> {
    const user = this.user;
    if (!user?.emailVerified || this.busy() || this.googleLinked()) return;
    this.busy.set(true); this.message.set(null);
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
      this.message.set('googleLinkDone');
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      this.message.set(code === 'auth/credential-already-in-use' ? 'googleInUse' : 'googleLinkFailed');
    } finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }
}
