import { Component, Input } from '@angular/core';

export interface UiTableColumn { readonly key: string; readonly label: string; readonly numeric?: boolean; readonly width?: string; }

@Component({ selector: 'app-ui-table', templateUrl: './ui-table.html' })
export class UiTable {
  @Input() columns: readonly UiTableColumn[] = [];
  @Input() rows: readonly Record<string, string>[] = [];
  @Input() caption = '';
}
