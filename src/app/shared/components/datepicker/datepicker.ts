import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  forwardRef,
  ElementRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-datepicker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Datepicker),
      multi: true,
    },
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <div class="datepicker-wrapper">
      <button
        type="button"
        class="datepicker-trigger"
        [class.datepicker-trigger--open]="isOpen()"
        [class.datepicker-trigger--disabled]="isDisabled()"
        [attr.aria-label]="ariaLabel() || 'Seleccionar fecha'"
        [attr.aria-expanded]="isOpen()"
        [disabled]="isDisabled()"
        (click)="toggle()"
      >
        <span class="datepicker-trigger__text" [class.datepicker-trigger__placeholder]="!displayValue()">
          {{ displayValue() || placeholder() }}
        </span>
        <svg class="datepicker-trigger__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="datepicker-panel" role="dialog" aria-modal="true" aria-label="Calendario">
          <!-- Header: month/year navigation -->
          <div class="datepicker-header">
            <button type="button" class="datepicker-nav" (click)="prevMonth()" aria-label="Mes anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span class="datepicker-title">{{ monthYearLabel() }}</span>
            <button type="button" class="datepicker-nav" (click)="nextMonth()" aria-label="Mes siguiente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <!-- Day-of-week headers -->
          <div class="datepicker-weekdays">
            @for (d of weekdays; track d) {
              <span class="datepicker-weekday">{{ d }}</span>
            }
          </div>

          <!-- Day grid -->
          <div class="datepicker-grid" role="grid">
            @for (day of calendarDays(); track $index) {
              @if (day === 0) {
                <span class="datepicker-day datepicker-day--empty"></span>
              } @else {
                <button
                  type="button"
                  class="datepicker-day"
                  [class.datepicker-day--today]="isToday(day)"
                  [class.datepicker-day--selected]="isSelectedDay(day)"
                  [attr.aria-label]="day + ' de ' + monthNames[viewMonth()] + ' de ' + viewYear()"
                  [attr.aria-selected]="isSelectedDay(day)"
                  (click)="selectDay(day)"
                >
                  {{ day }}
                </button>
              }
            }
          </div>

          <!-- Footer -->
          <div class="datepicker-footer">
            <button type="button" class="datepicker-today-btn" (click)="goToday()">Hoy</button>
            @if (value()) {
              <button type="button" class="datepicker-clear-btn" (click)="clear()">Limpiar</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .datepicker-wrapper {
      position: relative;
    }

    .datepicker-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 2.375rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      background: white;
      border: 1px solid var(--color-ucb-gray-300);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      text-align: left;
      color: var(--color-ucb-gray-900);
      gap: 0.5rem;
    }

    .datepicker-trigger:hover:not(:disabled) {
      border-color: var(--color-ucb-gray-400);
    }

    .datepicker-trigger:focus {
      outline: none;
      border-color: var(--color-ucb-primary);
      box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
    }

    .datepicker-trigger--open {
      border-color: var(--color-ucb-primary);
      box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
    }

    .datepicker-trigger--disabled {
      background-color: var(--color-ucb-gray-100);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .datepicker-trigger__text {
      flex: 1;
    }

    .datepicker-trigger__placeholder {
      color: var(--color-ucb-gray-500);
    }

    .datepicker-trigger__icon {
      flex-shrink: 0;
      color: var(--color-ucb-gray-400);
    }

    /* Panel */
    .datepicker-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 1100;
      background: white;
      border: 1px solid var(--color-ucb-gray-200);
      border-radius: 0.75rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: 0.75rem;
      min-width: 280px;
      animation: datepickerFadeIn 0.15s ease;
    }

    .datepicker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .datepicker-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-ucb-gray-800);
      text-transform: capitalize;
    }

    .datepicker-nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      background: transparent;
      border-radius: 0.375rem;
      cursor: pointer;
      color: var(--color-ucb-gray-600);
      transition: background-color 0.1s ease, color 0.1s ease;
    }

    .datepicker-nav:hover {
      background: var(--color-ucb-gray-100);
      color: var(--color-ucb-primary);
    }

    /* Weekdays */
    .datepicker-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      margin-bottom: 0.25rem;
    }

    .datepicker-weekday {
      text-align: center;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-ucb-gray-500);
      padding: 0.25rem 0;
      text-transform: uppercase;
    }

    /* Day grid */
    .datepicker-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .datepicker-day {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      margin: 0 auto;
      font-size: 0.8125rem;
      border: none;
      background: transparent;
      border-radius: 0.375rem;
      cursor: pointer;
      color: var(--color-ucb-gray-800);
      transition: background-color 0.1s ease, color 0.1s ease;
    }

    .datepicker-day:hover:not(.datepicker-day--empty) {
      background: var(--color-ucb-gray-100);
    }

    .datepicker-day--empty {
      cursor: default;
    }

    .datepicker-day--today {
      font-weight: 700;
      color: var(--color-ucb-primary);
      background: rgba(0, 51, 102, 0.06);
    }

    .datepicker-day--selected {
      background: var(--color-ucb-primary) !important;
      color: white !important;
      font-weight: 600;
    }

    /* Footer */
    .datepicker-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--color-ucb-gray-100);
    }

    .datepicker-today-btn,
    .datepicker-clear-btn {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      transition: background-color 0.1s ease;
    }

    .datepicker-today-btn {
      color: var(--color-ucb-primary);
    }

    .datepicker-today-btn:hover {
      background: rgba(0, 51, 102, 0.06);
    }

    .datepicker-clear-btn {
      color: var(--color-ucb-gray-600);
    }

    .datepicker-clear-btn:hover {
      background: var(--color-ucb-gray-100);
    }

    @keyframes datepickerFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
})
export class Datepicker implements ControlValueAccessor {
  private readonly elRef = inject(ElementRef);

  readonly placeholder = input('Seleccionar fecha');
  readonly ariaLabel = input('');

  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly value = signal<string>(''); // YYYY-MM-DD
  protected readonly viewMonth = signal(new Date().getMonth()); // 0-11
  protected readonly viewYear = signal(new Date().getFullYear());

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  protected readonly monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  protected readonly monthYearLabel = computed(
    () => `${this.monthNames[this.viewMonth()]} ${this.viewYear()}`
  );

  /** Display value formatted as DD/MM/YYYY */
  protected readonly displayValue = computed(() => {
    const v = this.value();
    if (!v) return '';
    const parts = v.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return v;
  });

  /** Calendar grid: 0 = empty cell, 1-31 = day number */
  protected readonly calendarDays = computed(() => {
    const month = this.viewMonth();
    const year = this.viewYear();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday-first: convert getDay() (0=Sun) to Mon-first index
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6; // Sunday becomes index 6

    const cells: number[] = [];
    // Empty cells before day 1
    for (let i = 0; i < startDay; i++) {
      cells.push(0);
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  });

  protected isToday(day: number): boolean {
    const now = new Date();
    return (
      day === now.getDate() &&
      this.viewMonth() === now.getMonth() &&
      this.viewYear() === now.getFullYear()
    );
  }

  protected isSelectedDay(day: number): boolean {
    const v = this.value();
    if (!v) return false;
    const parts = v.split('-');
    return (
      parseInt(parts[0], 10) === this.viewYear() &&
      parseInt(parts[1], 10) - 1 === this.viewMonth() &&
      parseInt(parts[2], 10) === day
    );
  }

  protected selectDay(day: number): void {
    const m = String(this.viewMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${this.viewYear()}-${m}-${d}`;
    this.value.set(dateStr);
    this.onChange(dateStr);
    this.onTouched();
    this.isOpen.set(false);
  }

  protected prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  protected goToday(): void {
    const now = new Date();
    this.viewMonth.set(now.getMonth());
    this.viewYear.set(now.getFullYear());
    this.selectDay(now.getDate());
  }

  protected clear(): void {
    this.value.set('');
    this.onChange('');
    this.onTouched();
    this.isOpen.set(false);
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      // Navigate to selected month if value exists
      const v = this.value();
      if (v) {
        const parts = v.split('-');
        this.viewYear.set(parseInt(parts[0], 10));
        this.viewMonth.set(parseInt(parts[1], 10) - 1);
      }
    } else {
      this.onTouched();
    }
  }

  protected close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  // ControlValueAccessor
  writeValue(value: string): void {
    this.value.set(value ?? '');
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        this.viewYear.set(parseInt(parts[0], 10));
        this.viewMonth.set(parseInt(parts[1], 10) - 1);
      }
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }
}
