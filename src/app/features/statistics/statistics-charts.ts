import { UiChip } from '../../shared/components/ui-chip/ui-chip';
import { Component, Input } from '@angular/core';
import { formatMinorExact } from '../../shared/utils/currency';
import { categoryLabel } from '../../shared/utils/category-label';
import { language, locale } from '../../shared/utils/i18n';
import type { LedgerTotal } from '../../shared/utils/ledger';
import type { CategorySlice, ChartData, TimePoint } from './chart-data';
import { statisticsText } from './statistics-text';

const colors = ['var(--color-pop-primary)', 'var(--color-pop-coral)', 'var(--color-pop-sun)', 'var(--color-pop-mint)', 'var(--color-pop-primary-dark)', 'var(--color-pop-muted)'];
const circumference = 2 * Math.PI * 40;

@Component({
  selector: 'app-statistics-charts',
  imports: [UiChip],
  template: `
    @if (hasData()) {
      <div class="mt-5 grid gap-5 xl:grid-cols-2">
        <section class="rounded-2xl border border-pop-border bg-pop-surface p-5" [attr.aria-label]="text('byCategory')">
          <h4 class="text-lg font-extrabold">{{ text('byCategory') }}</h4>
          <div class="mt-4 flex flex-col items-center gap-4 min-[360px]:flex-row">
            <svg class="h-36 w-36 shrink-0 min-[360px]:h-28 min-[360px]:w-28 sm:h-36 sm:w-36" viewBox="0 0 100 100" role="img" [attr.aria-label]="text('distribution') + ' ' + amount(data.totalMinor)">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-pop-lavender)" stroke-width="16" />
              @for (slice of data.categories; track slice.id; let index = $index) {
                <circle cx="50" cy="50" r="40" fill="none" [attr.stroke]="color(index)" stroke-width="16" [attr.stroke-dasharray]="dash(slice)" [attr.stroke-dashoffset]="offset(index)" transform="rotate(-90 50 50)" />
              }
              <text x="50" y="53" text-anchor="middle" class="fill-pop-text text-[10px] font-bold">{{ amount(data.totalMinor) }}</text>
            </svg>
            <ul class="w-full min-w-0 space-y-1 min-[360px]:flex-1">
              @for (slice of data.categories; track slice.id; let index = $index) {
                <li><app-ui-chip class="block w-full" [wide]="true" [selected]="selectedCategoryId === slice.id" (selectedChange)="selectedCategoryId = slice.id">
                  <span class="min-w-0 truncate"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-full" [style.background-color]="color(index)"></span>{{ categoryName(slice) }}</span>
                  <span class="shrink-0 font-medium">{{ percent(slice.amountMinor) }} %</span>
                </app-ui-chip></li>
              }
            </ul>
          </div>
          @if (chosenCategory(); as slice) { <p class="mt-3 rounded-xl bg-pop-lavender p-3 text-sm" role="status">{{ categoryName(slice) }} : <strong>{{ amount(slice.amountMinor) }}</strong></p> }
        </section>

        <section class="rounded-2xl border border-pop-border bg-pop-surface p-5" [attr.aria-label]="text('paidOwed')">
          <h4 class="text-lg font-extrabold">{{ text('paidOwed') }}</h4>
          <p class="mt-1 text-xs text-pop-muted">{{ text('balanceNote') }}</p>
          <div class="mt-4 space-y-4">
            @for (member of data.members; track member.userId) {
              <div>
                <p class="mb-1 break-all text-sm font-medium">{{ memberLabel(member) }}</p>
                <div class="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs">
                  <span>{{ text('paidShort') }}</span><div class="h-3 rounded-full bg-pop-lavender"><div class="h-3 rounded-full bg-pop-primary" [style.width.%]="bar(member.paidMinor)"></div></div><span>{{ amount(member.paidMinor) }}</span>
                  <span>{{ text('owedShort') }}</span><div class="h-3 rounded-full bg-pop-lavender"><div class="h-3 rounded-full bg-pop-coral" [style.width.%]="bar(member.owedMinor)"></div></div><span>{{ amount(member.owedMinor) }}</span>
                </div>
                <p class="mt-1 text-xs text-pop-muted">{{ text('afterSettlement') }} : <strong>{{ amount(member.balanceMinor) }}</strong></p>
              </div>
            } @empty { <p class="text-sm text-pop-muted">{{ text('noShare') }}</p> }
          </div>
        </section>
      </div>
      <section class="mt-5 rounded-2xl border border-pop-border bg-pop-surface p-5" [attr.aria-label]="text('spendingTrend')">
        <h4 class="text-lg font-extrabold">{{ text('spendingTrend') }}</h4>
        <svg class="mt-4 h-40 w-full" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" [attr.aria-label]="text('spendingFrom') + ' ' + data.timeline[0].period + ' – ' + data.timeline[data.timeline.length - 1].period">
          <path d="M 10 100 H 290" fill="none" stroke="var(--color-pop-border)" />
          <polyline [attr.points]="linePoints()" fill="none" stroke="var(--color-pop-primary)" stroke-width="3" stroke-linejoin="round" />
          @for (point of data.timeline; track point.period; let index = $index) {
            <circle [attr.cx]="pointX(index)" [attr.cy]="pointY(point)" r="4" fill="var(--color-pop-primary)" />
          }
        </svg>
        <div class="flex justify-between gap-3 text-xs text-pop-muted"><span>{{ data.timeline[0].period }}</span><span>{{ data.timeline[data.timeline.length - 1].period }}</span></div>
        <div class="mt-3 flex flex-wrap gap-2" [attr.aria-label]="text('periodValues')">
          @for (point of data.timeline; track point.period) {
            <app-ui-chip [selected]="selectedPeriod === point.period" (selectedChange)="selectedPeriod = point.period">{{ point.period }}</app-ui-chip>
          }
        </div>
        @if (chosenPeriod(); as point) { <p class="mt-3 text-sm" role="status">{{ point.period }} : <strong>{{ amount(point.amountMinor) }}</strong></p> }
      </section>
    }
  `,
})
export class StatisticsCharts {
  @Input({ required: true }) data!: ChartData;
  @Input({ required: true }) currency = '';
  @Input() userId = '';
  selectedCategoryId = '';
  selectedPeriod = '';
  readonly text = statisticsText;

  hasData(): boolean { return this.data.totalMinor > 0n; }
  amount(value: bigint): string { return formatMinorExact(value, this.currency, locale()); }
  color(index: number): string { return colors[index % colors.length]; }
  categoryName(slice: CategorySlice): string { return categoryLabel(slice.id, language(), slice.label); }
  percent(value: bigint): number { return this.data.totalMinor ? Number((value * 10000n + this.data.totalMinor / 2n) / this.data.totalMinor) / 100 : 0; }
  dash(slice: CategorySlice): string { return `${circumference * this.percent(slice.amountMinor) / 100} ${circumference}`; }
  offset(index: number): number { return -circumference * this.data.categories.slice(0, index).reduce((sum, slice) => sum + this.percent(slice.amountMinor), 0) / 100; }
  chosenCategory(): CategorySlice | undefined { return this.data.categories.find(slice => slice.id === this.selectedCategoryId); }
  memberLabel(member: LedgerTotal): string { return member.userId === this.userId ? this.text('me') : `${this.text('member')} ${member.userId.slice(0, 8)}`; }
  bar(value: bigint): number {
    const maximum = this.data.members.reduce((max, member) => member.paidMinor > max ? member.paidMinor : member.owedMinor > max ? member.owedMinor : max, 0n);
    return maximum ? Number(value * 100n / maximum) : 0;
  }
  chosenPeriod(): TimePoint | undefined { return this.data.timeline.find(point => point.period === this.selectedPeriod); }
  pointX(index: number): number { return this.data.timeline.length === 1 ? 150 : 10 + 280 * index / (this.data.timeline.length - 1); }
  pointY(point: TimePoint): number {
    const maximum = this.data.timeline.reduce((max, item) => item.amountMinor > max ? item.amountMinor : max, 0n);
    return maximum ? 100 - Number(point.amountMinor * 80n / maximum) : 100;
  }
  linePoints(): string { return this.data.timeline.map((point, index) => `${this.pointX(index)},${this.pointY(point)}`).join(' '); }
}
