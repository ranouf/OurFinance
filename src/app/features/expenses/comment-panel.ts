import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { CommentService, type ExpenseComment } from '../../core/firebase/comment-service';

@Component({
  selector: 'app-comment-panel',
  imports: [FormsModule],
  template: `
    <section class="rounded-xl border border-slate-200 p-3" aria-label="Commentaires de la dépense">
      <h3 class="font-semibold">Commentaires</h3>
      <form class="mt-3 space-y-2" (ngSubmit)="save()">
        <label class="block font-medium">Nouveau commentaire
          <textarea class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="commentText" [(ngModel)]="draft" maxlength="1000" rows="3" required></textarea>
        </label>
        <button class="rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50" type="submit" [disabled]="busy() || !draft.trim()">Publier le commentaire</button>
      </form>
      @if (entries().length) {
        <ol class="mt-4 divide-y divide-slate-200">
          @for (entry of entries(); track entry.id) {
            <li class="py-2">
              <p class="font-medium">{{ entry.authorId === user?.uid ? 'Moi' : 'Autre membre' }} · {{ date(entry) }}</p>
              <p class="mt-1 whitespace-pre-wrap break-words">{{ entry.text }}</p>
            </li>
          }
        </ol>
      } @else if (!busy() && !message()) { <p class="mt-3 text-slate-600">Aucun commentaire.</p> }
      @if (hasMore()) { <button class="mt-2 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">Afficher 20 commentaires de plus</button> }
      @if (message()) { <p class="mt-2 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class CommentPanel implements OnChanges {
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) groupId = '';
  @Input({ required: true }) expenseId = '';
  @Output() readonly changed = new EventEmitter<void>();
  readonly entries = signal<ExpenseComment[]>([]);
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  draft = '';
  private service?: CommentService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private pendingKey?: string;
  private pendingText?: string;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new CommentService(this.firebaseApp, this.workerUrl);
    if (changes['groupId'] || changes['expenseId']) void this.refresh();
  }
  date(entry: ExpenseComment): string { return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.createdAt.toDate()); }
  async refresh(): Promise<void> { this.entries.set([]); this.last = undefined; this.hasMore.set(false); this.message.set(''); await this.loadMore(); }
  async loadMore(): Promise<void> {
    if (!this.service || !this.groupId || !this.expenseId || this.busy()) return;
    this.busy.set(true);
    try {
      const page = await this.service.history(this.groupId, this.expenseId, this.last);
      this.entries.update(entries => [...entries, ...page.entries]); this.last = page.last; this.hasMore.set(page.hasMore);
    } catch { this.message.set('Commentaires indisponibles.'); }
    finally { this.busy.set(false); }
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.draft.trim() || this.busy()) return;
    const text = this.draft.trim();
    if (text.length > 1000) { this.message.set('Commentaire trop long.'); return; }
    if (this.pendingText !== text) this.pendingKey = undefined;
    const idempotencyKey = this.pendingKey ?? crypto.randomUUID();
    this.pendingKey = idempotencyKey; this.pendingText = text;
    this.busy.set(true);
    try {
      await this.service.create(this.user, this.groupId, this.expenseId, text, idempotencyKey);
      this.pendingKey = undefined; this.pendingText = undefined; this.draft = '';
      this.message.set('Commentaire publié.'); this.changed.emit();
      const page = await this.service.history(this.groupId, this.expenseId);
      this.entries.set(page.entries); this.last = page.last; this.hasMore.set(page.hasMore);
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Publication impossible.'); }
    finally { this.busy.set(false); }
  }
}
