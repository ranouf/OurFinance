import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-ui-pagination', templateUrl: './ui-pagination.html' })
export class UiPagination {
  @Input() label = 'Pagination';
  @Input() page = 1;
  @Input() pageCount = 1;
  @Input() previousLabel = 'Previous';
  @Input() nextLabel = 'Next';
  @Output() pageChange = new EventEmitter<number>();
  pages(): number[] { return Array.from({ length: this.pageCount }, (_, index) => index + 1); }
  select(page: number): void { if (page < 1 || page > this.pageCount) return; this.page = page; this.pageChange.emit(page); }
}
