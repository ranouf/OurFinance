import { Component, Input, OnDestroy, signal } from '@angular/core';
import { NgScrollbarModule } from 'ngx-scrollbar';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [NgScrollbarModule],
  template: `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <a class="brand" href="#dashboard"><span class="brand-mark">↻</span><span>OurFinance<span class="brand-dot">.</span></span></a>
        <nav class="side-nav" aria-label="Main">
          <a class="nav-item" [class.active]="route === 'dashboard'" href="#dashboard"><span class="nav-icon">⌂</span>Dashboard</a>
          <a class="nav-item" [class.active]="route === 'groups'" href="#groups"><span class="nav-icon">♧</span>Groups</a>
          <a class="nav-item" [class.active]="route === 'expenses'" href="#expenses"><span class="nav-icon">▤</span>Expenses</a>
          <a class="nav-item" [class.active]="route === 'statistics'" href="#statistics"><span class="nav-icon">▥</span>Statistics</a>
          <a class="nav-item" [class.active]="route === 'account'" href="#account"><span class="nav-icon">♙</span>Account</a>
        </nav>
      </aside>
      <main class="main">
        <img class="savings-scenery" src="./assets/table-tirelire.png" alt="">
        <img class="layout-scenery" src="./assets/toits-fleuris.png" alt="">
        <div class="authenticated-frame" [id]="route === 'dashboard' ? 'dashboard-page' : 'route-page'">
          <header class="topbar">
            <div>
              <h1>{{ title }} <span class="sunburst" aria-hidden="true">✳</span></h1>
              <p>{{ subtitle }}</p>
            </div>
            <div class="top-controls">
              <form id="search-form" class="search" role="search">
                <span aria-hidden="true">⌕</span>
                <input id="search-input" type="search" placeholder="Search an expense..." aria-label="Search an expense">
              </form>
              <button class="profile-button" id="profile-button" type="button" aria-label="Open profile menu" aria-expanded="false" aria-controls="profile-menu">
                <span class="portrait">CM</span><span class="chevron">⌄</span>
              </button>
              <div class="profile-menu" id="profile-menu" hidden>
                <a href="#account">Account settings</a>
                <button type="button" id="signout-button">Sign out</button>
              </div>
            </div>
          </header>
          <ng-scrollbar class="content-scrollbar" [class.is-scrolling]="isScrolling()" externalViewport=".content-scroll" orientation="vertical" appearance="compact">
            <div class="content-scroll" tabindex="0" role="region" [attr.aria-label]="title" (scroll)="onContentScroll()">
              <div class="shared-banner"><ng-content select="[banner]" /></div>
              <div class="shared-content"><ng-content select="[content]" /></div>
            </div>
          </ng-scrollbar>
        </div>
      </main>
    </div>
    <nav class="mobile-nav" aria-label="Mobile navigation"><a href="#dashboard" [class.active]="route === 'dashboard'"><span>⌂</span>Home</a><a href="#groups" [class.active]="route === 'groups'"><span>♧</span>Groups</a><button type="button" class="mobile-add" data-action="expense" aria-label="Add expense">+</button><a href="#expenses" [class.active]="route === 'expenses'"><span>▤</span>Expenses</a><a href="#account" [class.active]="route === 'account'"><span>♙</span>Account</a></nav>
  `
})
export class AuthenticatedLayoutComponent implements OnDestroy {
  @Input({ required: true }) route!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) subtitle!: string;

  protected readonly isScrolling = signal(false);
  private scrollIdleTimer?: ReturnType<typeof setTimeout>;

  protected onContentScroll(): void {
    this.isScrolling.set(true);
    clearTimeout(this.scrollIdleTimer);
    this.scrollIdleTimer = setTimeout(() => this.isScrolling.set(false), 800);
  }

  ngOnDestroy(): void {
    clearTimeout(this.scrollIdleTimer);
  }
}
