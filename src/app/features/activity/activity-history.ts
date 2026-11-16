import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { ActivityService, type ActivityEntry } from '../../core/firebase/activity-service';
import type { Group } from '../../core/firebase/group-model';

const labels: Record<string, string> = {
  expense_created: 'Dépense créée',
  settlement_recorded: 'Remboursement déclaré',
  import_created: 'Import créé',
  import_undone: 'Import annulé',
  category_created: 'Catégorie créée',
  category_updated: 'Catégorie modifiée',
  category_archived: 'Catégorie archivée',
  category_reactivated: 'Catégorie réactivée',
  comment_created: 'Commentaire ajouté',
};

@Component({
  selector: 'app-activity-history',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Activité du groupe">
      <h2 class="text-lg font-semibold">Activité du groupe</h2>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="activityGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">Actualiser</button>
        @if (entries().length) {
          <ol class="mt-4 divide-y divide-slate-200">
            @for (entry of entries(); track entry.id) {
              <li class="py-3 text-sm">
                <p class="font-medium">{{ label(entry.action) }}</p>
                <p class="mt-1 text-slate-600">{{ entry.actorId === user?.uid ? 'Moi' : 'Autre membre' }} · {{ date(entry) }}</p>
              </li>
            }
          </ol>
        } @else if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">Aucune activité dans ce groupe.</p> }
        @if (hasMore()) { <button class="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">Afficher plus</button> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class ActivityHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly entries = signal<ActivityEntry[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: ActivityService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new ActivityService(this.firebaseApp);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  label(action: string): string { return labels[action] ?? 'Activité enregistrée'; }
  date(entry: ActivityEntry): string { return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.at.toDate()); }
  async refresh(): Promise<void> {
    this.entries.set([]);
    this.last = undefined;
    this.hasMore.set(false);
    await this.load();
  }
  async loadMore(): Promise<void> { await this.load(); }
  private async load(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.message.set('');
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const page = await this.service.history(groupId, this.last);
      if (requestId !== this.requestId) return;
      this.entries.update(entries => [...entries, ...page.entries]);
      this.last = page.last;
      this.hasMore.set(page.hasMore);
    } catch { if (requestId === this.requestId) this.message.set('Activité indisponible.'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
