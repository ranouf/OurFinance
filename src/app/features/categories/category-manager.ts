import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { CategoryService, type CategoryDraft } from '../../core/firebase/category-service';
import type { Group } from '../../core/firebase/group-model';
import { categoryColorClass, categoryColors, categoryIcons, type CustomCategory } from '../../shared/utils/categories';

@Component({
  selector: 'app-category-manager',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Catégories du groupe">
      <h2 class="text-lg font-semibold">Catégories du groupe</h2>
      <p class="mt-1 text-sm text-slate-600">Les catégories de base sont disponibles dans tous les groupes. Les membres actifs peuvent partager leurs propres catégories ici.</p>
      <label class="mt-4 block text-sm font-medium">Groupe
        <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="categoryGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="loadGroup()">
          <option value="">Choisir un groupe</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <label class="mt-4 block text-sm font-medium">Catégorie personnalisée
          <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="managedCategory" [(ngModel)]="selectedId" (ngModelChange)="selectCategory()">
            <option value="">Nouvelle catégorie</option>
            @for (category of items(); track category.id) { <option [value]="category.id">{{ category.icon }} {{ category.label }}{{ category.status === 'archived' ? ' (archivée)' : '' }}</option> }
          </select>
        </label>
        <label class="mt-3 block text-sm font-medium">Nom
          <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="categoryName" [(ngModel)]="draft.name" maxlength="40" />
        </label>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium">Icône
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="categoryIcon" [(ngModel)]="draft.iconId">
              @for (icon of icons; track icon.id) { <option [value]="icon.id">{{ icon.glyph }} {{ icon.label }}</option> }
            </select>
          </label>
          <label class="block text-sm font-medium">Couleur
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="categoryColor" [(ngModel)]="draft.color">
              @for (color of colors; track color.id) { <option [value]="color.id">{{ color.label }}</option> }
            </select>
          </label>
        </div>
        <p class="mt-3 text-sm"><span class="rounded-md px-2 py-1" [class]="colorClass(draft.color)">{{ previewIcon() }} {{ draft.name || 'Aperçu' }}</span></p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" type="button" [disabled]="busy() || !draft.name.trim()" (click)="save()">{{ selectedId ? 'Enregistrer les modifications' : 'Créer la catégorie' }}</button>
          @if (selectedId) {
            <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" type="button" [disabled]="busy()" (click)="toggleArchive()">{{ selected()?.status === 'archived' ? 'Réactiver' : 'Archiver' }}</button>
          }
        </div>
        @if (items().length) { <p class="mt-3 text-sm text-slate-600">{{ items().length }} catégorie(s) personnalisée(s), y compris les archives.</p> }
      }
      @if (message()) { <p class="mt-4 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class CategoryManager implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Input({ required: true }) user?: User;
  @Output() readonly changed = new EventEmitter<void>();
  readonly icons = categoryIcons;
  readonly colors = categoryColors;
  readonly items = signal<CustomCategory[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  selectedId = '';
  draft: CategoryDraft = this.emptyDraft();
  private service?: CategoryService;

  ngOnChanges(): void { if (this.firebaseApp && this.workerUrl) this.service = new CategoryService(this.firebaseApp, this.workerUrl); }
  private emptyDraft(): CategoryDraft { return { name: '', iconId: 'pin', color: 'teal', status: 'active' }; }
  selected(): CustomCategory | undefined { return this.items().find(item => item.id === this.selectedId); }
  previewIcon(): string { return this.icons.find(icon => icon.id === this.draft.iconId)?.glyph ?? '📌'; }
  colorClass(color: string): string { return categoryColorClass(color); }
  selectCategory(): void {
    const item = this.selected();
    this.draft = item ? { name: item.label, iconId: item.iconId, color: item.color, status: item.status } : this.emptyDraft();
    this.message.set('');
  }
  async loadGroup(): Promise<void> {
    this.selectedId = ''; this.draft = this.emptyDraft(); this.items.set([]); this.message.set('');
    await this.refresh();
  }
  private async refresh(): Promise<void> {
    const groupId = this.selectedGroupId;
    if (!groupId || !this.service) return;
    try {
      const items = await this.service.list(groupId);
      if (groupId === this.selectedGroupId) this.items.set(items);
    } catch { if (groupId === this.selectedGroupId) this.message.set('Catégories indisponibles.'); }
  }
  async save(): Promise<void> {
    if (!this.service || !this.user || !this.selectedGroupId || !this.draft.name.trim() || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      if (this.selectedId) await this.service.update(this.user, this.selectedGroupId, this.selectedId, this.draft);
      else this.selectedId = await this.service.create(this.user, this.selectedGroupId, this.draft);
      await this.refresh(); this.selectCategory(); this.changed.emit(); this.message.set('Catégorie enregistrée.');
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { this.busy.set(false); }
  }
  async toggleArchive(): Promise<void> {
    const item = this.selected();
    if (!item || !this.service || !this.user || !this.selectedGroupId || this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      await this.service.update(this.user, this.selectedGroupId, item.id, { name: item.label, iconId: item.iconId, color: item.color, status: item.status === 'active' ? 'archived' : 'active' });
      await this.refresh(); this.selectCategory(); this.changed.emit(); this.message.set(item.status === 'active' ? 'Catégorie archivée.' : 'Catégorie réactivée.');
    } catch (error) { this.message.set(error instanceof Error ? error.message : 'Modification impossible.'); }
    finally { this.busy.set(false); }
  }
}
