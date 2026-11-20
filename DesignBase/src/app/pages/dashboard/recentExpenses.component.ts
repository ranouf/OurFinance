import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-recent-expenses',
  standalone: true,
  templateUrl: './recentExpenses.html',
  styles: [':host { display: contents; }']
})
export class DashboardRecentExpensesComponent {}
