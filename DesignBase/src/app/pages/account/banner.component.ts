import { Component } from '@angular/core';

@Component({
  selector: 'app-account-banner',
  standalone: true,
  templateUrl: './banner.html',
  styles: [':host { display: contents; }']
})
export class AccountBannerComponent {}
