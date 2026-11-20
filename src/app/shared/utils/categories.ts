export const categoryIcons = [
  { id: 'cart', label: 'Panier', glyph: '🛒' },
  { id: 'home', label: 'Maison', glyph: '🏠' },
  { id: 'education', label: 'Scolarité', glyph: '🎓' },
  { id: 'restaurant', label: 'Restaurant', glyph: '🍽️' },
  { id: 'transport', label: 'Transport', glyph: '🚇' },
  { id: 'health', label: 'Santé', glyph: '🩺' },
  { id: 'leisure', label: 'Loisirs', glyph: '🎭' },
  { id: 'gift', label: 'Cadeau', glyph: '🎁' },
  { id: 'tools', label: 'Services', glyph: '🛠️' },
  { id: 'pin', label: 'Autre', glyph: '📌' },
] as const;

export const categoryColors = [
  { id: 'teal', swatch: 'bg-teal-500', label: 'Sarcelle', classes: 'bg-teal-50 text-teal-900' },
  { id: 'sky', swatch: 'bg-sky-500', label: 'Bleu', classes: 'bg-sky-50 text-sky-900' },
  { id: 'amber', swatch: 'bg-amber-500', label: 'Ambre', classes: 'bg-amber-50 text-amber-900' },
  { id: 'rose', swatch: 'bg-rose-500', label: 'Rose', classes: 'bg-rose-50 text-rose-900' },
  { id: 'violet', swatch: 'bg-violet-500', label: 'Violet', classes: 'bg-violet-50 text-violet-900' },
  { id: 'slate', swatch: 'bg-slate-500', label: 'Ardoise', classes: 'bg-slate-100 text-slate-900' },
] as const;

export type CategoryIcon = typeof categoryIcons[number]['id'];
export type CategoryColor = typeof categoryColors[number]['id'];
export interface CategoryDefinition {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly color: CategoryColor;
}
export interface CustomCategory extends CategoryDefinition {
  readonly iconId: CategoryIcon;
  readonly status: 'active' | 'archived';
}

export const categories: readonly CategoryDefinition[] = [
  { id: 'groceries', label: 'Épicerie', icon: '🛒', color: 'teal' },
  { id: 'rent', label: 'Loyer', icon: '🏠', color: 'sky' },
  { id: 'education', label: 'Scolarité', icon: '🎓', color: 'violet' },
  { id: 'restaurant', label: 'Restaurant', icon: '🍽️', color: 'amber' },
  { id: 'transport', label: 'Transport', icon: '🚇', color: 'sky' },
  { id: 'health', label: 'Santé', icon: '🩺', color: 'rose' },
  { id: 'leisure', label: 'Loisirs', icon: '🎭', color: 'violet' },
  { id: 'gifts', label: 'Cadeaux', icon: '🎁', color: 'rose' },
  { id: 'services', label: 'Services', icon: '🛠️', color: 'slate' },
  { id: 'food', label: 'Autres aliments', icon: '🛒', color: 'teal' },
  { id: 'housing', label: 'Autres frais de logement', icon: '🏠', color: 'sky' },
  { id: 'other', label: 'Autre', icon: '📌', color: 'slate' },
];

export function categoryById(id: string): CategoryDefinition { return categories.find(category => category.id === id) ?? categories.at(-1)!; }
export function categoryColorClass(color: string): string { return categoryColors.find(item => item.id === color)?.classes ?? categoryColors.at(-1)!.classes; }
export function isCustomCategoryId(id: string): boolean { return /^custom_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); }
