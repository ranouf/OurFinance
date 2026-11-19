import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from 'firebase/auth';
import { InvitationService } from '../../core/firebase/invitation-service';
import type { Group } from '../../core/firebase/group-model';

@Component({
  selector: 'app-invitation-panel',
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Invitations">
      <h2 class="text-lg font-semibold">Invitations</h2>
      <p class="mt-1 text-sm text-slate-600">Le propriétaire invite une adresse confirmée. Transmettez le code par un canal privé ; il n'est conservé que pendant cette session.</p>
      @if (ownedGroups().length) {
        <form class="mt-4 space-y-3" (ngSubmit)="create()">
          <app-field class="block" controlId="invitation-group" label="Groupe">
            <app-dropdown controlId="invitation-group" name="invitationGroup" [options]="groupDropdownOptions(ownedGroups(), 'Choisir un groupe')" [(ngModel)]="selectedGroupId" required />
          </app-field>
          <label class="block text-sm font-medium">Courriel du destinataire
            <input appUiControl class="mt-1 w-full" type="email" name="targetEmail" [(ngModel)]="targetEmail" autocomplete="off" required />
          </label>
          <app-ui-button variant="primary"  type="submit" [disabled]="busy()">Créer une invitation</app-ui-button>
        </form>
        @if (hasCode()) {
          <div class="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
            <p>Code à usage unique valable 72 heures. Copiez-le maintenant et transmettez-le au destinataire.</p>
            <app-ui-button variant="outline" class="mt-2" type="button" (click)="copy()">Copier le code</app-ui-button>
          </div>
        }
      }
      <form class="mt-5 space-y-3 border-t border-slate-200 pt-4" (ngSubmit)="accept()">
        <h3 class="font-medium">Rejoindre un groupe</h3>
        <label class="block text-sm font-medium">Code d'invitation reçu
          <input appUiControl class="mt-1 w-full" name="receivedCode" [(ngModel)]="receivedCode" autocomplete="off" required />
        </label>
        <app-ui-button variant="outline"  type="submit" [disabled]="busy()">Rejoindre le groupe</app-ui-button>
      </form>
      @if (message()) { <app-ui-alert [variant]="message().includes('impossible') || message().includes('invalide') ? 'error' : 'success'" class="mt-3">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class InvitationPanel {
  readonly groupDropdownOptions = groupDropdownOptions;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl = '';
  @Output() readonly joined = new EventEmitter<void>();
  readonly busy = signal(false);
  readonly hasCode = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  targetEmail = '';
  receivedCode = '';
  private code = '';

  ownedGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid && group.status === 'active'); }

  async create(): Promise<void> {
    if (!this.user || !this.selectedGroupId || !this.targetEmail.trim() || this.busy()) return;
    this.busy.set(true); this.message.set(''); this.code = ''; this.hasCode.set(false);
    try {
      this.code = await new InvitationService(this.workerUrl).create(this.user, this.selectedGroupId, this.targetEmail);
      this.hasCode.set(true); this.message.set('Invitation créée. Copiez le code avant de quitter cette page.');
    } catch { this.message.set('Création de l’invitation impossible.'); }
    finally { this.busy.set(false); }
  }

  async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.code); this.message.set('Code copié. Transmettez-le par un canal privé.'); }
    catch { this.message.set('Copie impossible. Réessayez depuis un navigateur autorisant le presse-papiers.'); }
  }

  async accept(): Promise<void> {
    if (!this.user || !this.receivedCode.trim() || this.busy()) return;
    const code = this.receivedCode;
    this.receivedCode = '';
    this.busy.set(true); this.message.set('');
    try {
      await new InvitationService(this.workerUrl).accept(this.user, code);
      this.joined.emit(); this.message.set('Invitation acceptée. Le groupe est maintenant disponible.');
    } catch { this.message.set('Code invalide, expiré ou déjà utilisé.'); }
    finally { this.busy.set(false); }
  }
}
