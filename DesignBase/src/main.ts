import { bootstrapApplication } from '@angular/platform-browser';
import { Component, HostListener, signal } from '@angular/core';
import { DashboardPageComponent } from './app/pages/dashboard/dashboard-page.component';
import { GroupsPageComponent } from './app/pages/groups/groups-page.component';
import { ExpensesPageComponent } from './app/pages/expenses/expenses-page.component';
import { StatisticsPageComponent } from './app/pages/statistics/statistics-page.component';
import { AccountPageComponent } from './app/pages/account/account-page.component';
import { LoginPageComponent } from './app/pages/login/login-page.component';
import { JoinPageComponent } from './app/pages/join/join-page.component';

type Route = 'dashboard' | 'groups' | 'expenses' | 'statistics' | 'account' | 'login' | 'join';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardPageComponent, GroupsPageComponent, ExpensesPageComponent, StatisticsPageComponent, AccountPageComponent, LoginPageComponent, JoinPageComponent],
  template: `
    @switch (route()) {
      @case ('groups') { <app-groups-page /> }
      @case ('expenses') { <app-expenses-page /> }
      @case ('statistics') { <app-statistics-page /> }
      @case ('account') { <app-account-page /> }
      @case ('login') { <app-login-page /> }
      @case ('join') { <app-join-page /> }
      @default { <app-dashboard-page /> }
    }
    <img class="reference-overlay" [hidden]="!showComparison()" [src]="'./assets/' + route() + '-reference_resize.png'" [style.opacity]="comparisonOpacity() / 100" alt="" aria-hidden="true">
    <div class="comparison-controls"><label><input type="checkbox" [checked]="showComparison()" (change)="toggleComparison($event)"> Reference overlay</label><span>1487 × 1058</span><label for="comparison-opacity">Opacity <output>{{ comparisonOpacity() }}%</output></label><input id="comparison-opacity" type="range" min="0" max="100" [value]="comparisonOpacity()" (input)="changeOpacity($event)"></div>
    <dialog id="demo-dialog"><form method="dialog"><button class="dialog-close" aria-label="Close">×</button><h2 id="dialog-title"></h2><p id="dialog-copy"></p><button class="dialog-ok">Got it</button></form></dialog>
  `
})
class AppComponent {
  readonly route = signal<Route>(this.readRoute());
  readonly showComparison = signal(false);
  readonly comparisonOpacity = signal(50);

  constructor() { this.updateBody(); }

  @HostListener('window:hashchange')
  onRouteChange(): void { this.route.set(this.readRoute()); this.updateBody(); }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action],[data-prototype-action]');
    if (action) {
      const name = action.dataset['action'] || action.dataset['prototypeAction'] || '';
      if (name === 'expense' || name === 'Add expense') { location.hash = 'expenses?new=1'; return; }
      this.openDialog(name, name === 'invite' ? 'Share an invitation link or QR code with a new group member.' : 'This action is available in the complete application.');
      return;
    }
    for (const [buttonId, panelId] of [['group-switch', 'group-menu'], ['profile-button', 'profile-menu']]) {
      const button = target.closest<HTMLButtonElement>(`#${buttonId}`);
      const panel = document.getElementById(panelId);
      if (button && panel) { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); return; }
    }
    const authTab = target.closest<HTMLButtonElement>('[data-auth-mode]');
    if (authTab) {
      document.querySelectorAll('[data-auth-mode]').forEach(tab => tab.classList.toggle('active', tab === authTab));
      const submit = document.getElementById('auth-submit');
      if (submit) submit.textContent = authTab.dataset['authMode'] === 'signup' ? 'Sign up' : 'Sign in';
    }
    if (target.closest('#show-password')) {
      const input = document.querySelector<HTMLInputElement>('#auth-password');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    }
    const languageToggle = target.closest<HTMLButtonElement>('.language-toggle');
    if (languageToggle) {
      const options = document.getElementById('language-options');
      if (options) { options.hidden = !options.hidden; languageToggle.setAttribute('aria-expanded', String(!options.hidden)); }
    }
    const languageOption = target.closest<HTMLButtonElement>('[data-language]');
    if (languageOption) {
      const field = languageOption.closest<HTMLElement>('.language-field');
      const select = field?.querySelector<HTMLSelectElement>('select');
      const toggle = field?.querySelector<HTMLButtonElement>('.language-toggle');
      const options = document.getElementById('language-options');
      if (select && toggle && options) {
        select.value = languageOption.dataset['language'] || 'English';
        toggle.firstChild!.textContent = `${select.value} `;
        field?.querySelectorAll('[data-language]').forEach(option => option.classList.toggle('selected', option === languageOption));
        options.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    }
  }

  @HostListener('document:submit', ['$event'])
  onSubmit(event: Event): void {
    if ((event.target as HTMLElement).matches('.expense-form,.repay-form,.preferences-form,#auth-form')) {
      event.preventDefault();
      this.openDialog('Preview only', 'This form will save data after application integration.');
    }
  }

  toggleComparison(event: Event): void { this.showComparison.set((event.target as HTMLInputElement).checked); }
  changeOpacity(event: Event): void { this.comparisonOpacity.set(Number((event.target as HTMLInputElement).value)); }

  private readRoute(): Route {
    const value = location.hash.slice(1).split('?')[0];
    if (value === 'groups' || value === 'expenses' || value === 'statistics' || value === 'account' || value === 'join') return value;
    if (value === 'login' || value === 'signup' || value === 'recovery') return 'login';
    return 'dashboard';
  }

  private updateBody(): void {
    document.body.dataset['route'] = this.route();
    document.body.classList.toggle('public-view', this.route() === 'login' || this.route() === 'join');
    document.body.classList.toggle('expense-entry-open', location.hash.includes('?new=1'));
  }

  private openDialog(title: string, copy: string): void {
    const dialog = document.querySelector<HTMLDialogElement>('#demo-dialog');
    if (!dialog) return;
    dialog.querySelector<HTMLElement>('#dialog-title')!.textContent = title;
    dialog.querySelector<HTMLElement>('#dialog-copy')!.textContent = copy;
    dialog.showModal();
  }
}

bootstrapApplication(AppComponent);
