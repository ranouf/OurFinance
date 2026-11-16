import { Component, Input } from '@angular/core';
import { formatMinorExact } from '../../shared/utils/currency';
import type { LedgerTotal } from '../../shared/utils/ledger';
import type { CategorySlice, ChartData, TimePoint } from './chart-data';

const colors = ['#0f766e', '#2563eb', '#d97706', '#e11d48', '#7c3aed', '#475569'];
const circumference = 2 * Math.PI * 40;

@Component({
  selector: 'app-statistics-charts',
  template: `
    @if (hasData()) {
      <div class="mt-5 grid gap-5">
        <section class="rounded-xl border border-slate-200 p-4" aria-label="Dépenses par catégorie">
          <h4 class="font-semibold">Dépenses par catégorie</h4>
          <div class="mt-4 flex flex-col items-center gap-4">
            <svg class="h-40 w-40 shrink-0" viewBox="0 0 100 100" role="img" [attr.aria-label]="'Répartition de ' + amount(data.totalMinor)">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="16" />
              @for (slice of data.categories; track slice.id; let index = $index) {
                <circle cx="50" cy="50" r="40" fill="none" [attr.stroke]="color(index)" stroke-width="16" [attr.stroke-dasharray]="dash(slice)" [attr.stroke-dashoffset]="offset(index)" transform="rotate(-90 50 50)" />
              }
              <text x="50" y="53" text-anchor="middle" class="fill-slate-900 text-[11px] font-semibold">{{ data.categories.length }} catégories</text>
            </svg>
            <ul class="w-full min-w-0 space-y-1">
              @for (slice of data.categories; track slice.id; let index = $index) {
                <li><button type="button" class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-700" [class.bg-teal-50]="selectedCategoryId === slice.id" [attr.aria-pressed]="selectedCategoryId === slice.id" (click)="selectedCategoryId = slice.id">
                  <span class="min-w-0 truncate"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-full" [style.background-color]="color(index)"></span>{{ slice.label }}</span>
                  <span class="shrink-0 font-medium">{{ percent(slice.amountMinor) }} %</span>
                </button></li>
              }
            </ul>
          </div>
          @if (chosenCategory(); as slice) { <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm" role="status">{{ slice.label }} : <strong>{{ amount(slice.amountMinor) }}</strong></p> }
        </section>

        <section class="rounded-xl border border-slate-200 p-4" aria-label="Paiements et parts par membre">
          <h4 class="font-semibold">Payé et part due par membre</h4>
          <p class="mt-1 text-xs text-slate-600">Le solde inclut aussi les remboursements ; il est distinct de l’écart payé moins dû.</p>
          <div class="mt-4 space-y-4">
            @for (member of data.members; track member.userId) {
              <div>
                <p class="mb-1 break-all text-sm font-medium">{{ memberLabel(member) }}</p>
                <div class="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs">
                  <span>Payé</span><div class="h-3 rounded-full bg-slate-100"><div class="h-3 rounded-full bg-teal-700" [style.width.%]="bar(member.paidMinor)"></div></div><span>{{ amount(member.paidMinor) }}</span>
                  <span>Part due</span><div class="h-3 rounded-full bg-slate-100"><div class="h-3 rounded-full bg-sky-600" [style.width.%]="bar(member.owedMinor)"></div></div><span>{{ amount(member.owedMinor) }}</span>
                </div>
                <p class="mt-1 text-xs text-slate-600">Solde après remboursements : <strong>{{ amount(member.balanceMinor) }}</strong></p>
              </div>
            } @empty { <p class="text-sm text-slate-600">Aucune part connue.</p> }
          </div>
        </section>
      </div>
      <section class="mt-5 rounded-xl border border-slate-200 p-4" aria-label="Évolution des dépenses">
        <h4 class="font-semibold">Évolution des dépenses</h4>
        <svg class="mt-4 h-40 w-full" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" [attr.aria-label]="'Dépenses de ' + data.timeline[0].period + ' à ' + data.timeline[data.timeline.length - 1].period">
          <path d="M 10 100 H 290" fill="none" stroke="#cbd5e1" />
          <polyline [attr.points]="linePoints()" fill="none" stroke="#0f766e" stroke-width="3" stroke-linejoin="round" />
          @for (point of data.timeline; track point.period; let index = $index) {
            <circle [attr.cx]="pointX(index)" [attr.cy]="pointY(point)" r="4" fill="#0f766e" />
          }
        </svg>
        <div class="flex justify-between gap-3 text-xs text-slate-600"><span>{{ data.timeline[0].period }}</span><span>{{ data.timeline[data.timeline.length - 1].period }}</span></div>
        <div class="mt-3 flex flex-wrap gap-2" aria-label="Valeurs par période">
          @for (point of data.timeline; track point.period) {
            <button type="button" class="rounded-lg border border-slate-300 px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-teal-700" [class.border-teal-700]="selectedPeriod === point.period" [attr.aria-pressed]="selectedPeriod === point.period" (click)="selectedPeriod = point.period">{{ point.period }}</button>
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

  hasData(): boolean { return this.data.totalMinor > 0n; }
  amount(value: bigint): string { return formatMinorExact(value, this.currency, 'fr-CA'); }
  color(index: number): string { return colors[index % colors.length]; }
  percent(value: bigint): number { return this.data.totalMinor ? Number((value * 10000n + this.data.totalMinor / 2n) / this.data.totalMinor) / 100 : 0; }
  dash(slice: CategorySlice): string { return `${circumference * this.percent(slice.amountMinor) / 100} ${circumference}`; }
  offset(index: number): number { return -circumference * this.data.categories.slice(0, index).reduce((sum, slice) => sum + this.percent(slice.amountMinor), 0) / 100; }
  chosenCategory(): CategorySlice | undefined { return this.data.categories.find(slice => slice.id === this.selectedCategoryId); }
  memberLabel(member: LedgerTotal): string { return member.userId === this.userId ? 'Moi' : `Membre ${member.userId.slice(0, 8)}`; }
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
