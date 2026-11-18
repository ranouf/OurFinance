import { detectLanguage, language, locale, setLanguage, t, type Language, type MessageKey } from '../../shared/utils/i18n';

/** One business boundary for the active language; profile persistence belongs to ProfileService. */
export class LanguageService {
  detect(languages: readonly string[]): Language { return detectLanguage(languages); }
  current(): Language { return language(); }
  locale(): string { return locale(); }
  translate(key: MessageKey): string { return t(key); }
  use(value: Language): void {
    if (value !== 'fr' && value !== 'en' && value !== 'ja') throw new Error('Langue non prise en charge');
    setLanguage(value);
  }
}
