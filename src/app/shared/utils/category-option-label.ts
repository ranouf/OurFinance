import type { CategoryColor, CategoryIcon } from './categories';
import type { Language } from './i18n';

const iconNames: Record<CategoryIcon, Record<Language, string>> = {
  cart: { fr: 'Panier', en: 'Cart', ja: 'カート' },
  home: { fr: 'Maison', en: 'Home', ja: '家' },
  education: { fr: 'Scolarité', en: 'Education', ja: '教育' },
  restaurant: { fr: 'Restaurant', en: 'Restaurant', ja: 'レストラン' },
  transport: { fr: 'Transport', en: 'Transport', ja: '交通' },
  health: { fr: 'Santé', en: 'Health', ja: '健康' },
  leisure: { fr: 'Loisirs', en: 'Leisure', ja: '娯楽' },
  gift: { fr: 'Cadeau', en: 'Gift', ja: '贈り物' },
  tools: { fr: 'Services', en: 'Services', ja: 'サービス' },
  pin: { fr: 'Autre', en: 'Other', ja: 'その他' },
};
const colorNames: Record<CategoryColor, Record<Language, string>> = {
  teal: { fr: 'Sarcelle', en: 'Teal', ja: '青緑' },
  sky: { fr: 'Bleu', en: 'Blue', ja: '青' },
  amber: { fr: 'Ambre', en: 'Amber', ja: '琥珀色' },
  rose: { fr: 'Rose', en: 'Rose', ja: 'ローズ' },
  violet: { fr: 'Violet', en: 'Violet', ja: '紫' },
  slate: { fr: 'Ardoise', en: 'Slate', ja: 'スレート' },
};

export function categoryIconLabel(icon: CategoryIcon, language: Language): string { return iconNames[icon][language]; }
export function categoryColorLabel(color: CategoryColor, language: Language): string { return colorNames[color][language]; }
