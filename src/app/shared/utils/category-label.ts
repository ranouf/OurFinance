import type { Language } from './i18n';
import { categoryById, isCustomCategoryId } from './categories';

const labels: Record<string, Record<Language, string>> = {
  groceries: { fr: 'Épicerie', en: 'Groceries', ja: '食料品' },
  rent: { fr: 'Loyer', en: 'Rent', ja: '家賃' },
  education: { fr: 'Scolarité', en: 'Education', ja: '教育' },
  restaurant: { fr: 'Restaurant', en: 'Restaurant', ja: '外食' },
  transport: { fr: 'Transport', en: 'Transport', ja: '交通' },
  health: { fr: 'Santé', en: 'Health', ja: '医療' },
  leisure: { fr: 'Loisirs', en: 'Leisure', ja: '娯楽' },
  gifts: { fr: 'Cadeaux', en: 'Gifts', ja: '贈り物' },
  services: { fr: 'Services', en: 'Services', ja: 'サービス' },
  food: { fr: 'Autres aliments', en: 'Other food', ja: 'その他の食品' },
  housing: { fr: 'Autres frais de logement', en: 'Other housing', ja: 'その他の住居費' },
  other: { fr: 'Autre', en: 'Other', ja: 'その他' },
};

/** Custom names remain exactly as their members entered them. */
export function categoryLabel(id: string, language: Language, customName?: string): string {
  if (isCustomCategoryId(id)) return customName ?? id;
  return labels[id]?.[language] ?? categoryById(id).label;
}
