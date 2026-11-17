import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App } from '../../app';
import { AppShell } from '../../shared/components/app-shell/app-shell';

@Component({
  selector: 'app-secured-layout',
  imports: [AppShell, RouterOutlet],
  templateUrl: './secured-layout.component.html',
})
export class SecuredLayoutComponent {
  readonly app = inject(App);
  private readonly router = inject(Router);
  searchExpenses(term: string): void { void this.router.navigate(['/expenses'], { queryParams: { search: term } }); }
}
