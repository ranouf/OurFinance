import { Component, HostListener, effect, inject } from '@angular/core';
import { TranslatePipe, TranslateService, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { GalleryTranslateLoader } from '../../gallery/gallery/gallery-translations';
import { RouterLink, RouterOutlet } from '@angular/router';
import { language, setLanguage } from '../../shared/utils/i18n';

@Component({
  selector: 'app-gallery-layout',
  imports: [RouterLink, RouterOutlet, TranslatePipe],
  providers: [...provideTranslateService({ loader: provideTranslateLoader(GalleryTranslateLoader), fallbackLang: 'en', lang: language() })],
  templateUrl: './gallery-layout.component.html',
})
export class GalleryLayoutComponent {
  readonly language = language;
  readonly setLanguage = setLanguage;
  private readonly translate = inject(TranslateService);

  constructor() { effect(() => { void this.translate.use(language()); }); }
  activeSection = 'foundations';

  @HostListener('window:scroll')
  updateActiveSection(): void {
    for (const id of ['guides', 'responsive', 'business', 'patterns', 'forms', 'foundations']) {
      const section = document.getElementById(id);
      if (section && section.getBoundingClientRect().top <= 180) { this.activeSection = id; break; }
    }
  }
}
