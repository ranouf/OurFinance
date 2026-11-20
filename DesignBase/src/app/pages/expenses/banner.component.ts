import { Component } from '@angular/core';

@Component({
  selector: 'app-expenses-banner',
  standalone: true,
  templateUrl: './banner.html',
  styles: [':host { display: contents; }']
})
export class ExpensesBannerComponent {}
