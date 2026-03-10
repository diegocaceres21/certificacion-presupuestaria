import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  forwardRef,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ComboboxOption {
  value: string | number;
  label: string;
}

@Component({
  selector: 'app-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Combobox),
      multi: true,
    },
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  template: `
    <!-- Single select -->
    @if (!multiple()) {
      <div class="combobox-wrapper">
        <button
          type="button"
          class="combobox-trigger"
          [class.combobox-trigger--open]="isOpen()"
          [class.combobox-trigger--disabled]="isDisabled()"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-label]="ariaLabel()"
          [disabled]="isDisabled()"
          (click)="toggle()"
        >
          <span class="combobox-trigger__text" [class.combobox-trigger__placeholder]="!selectedLabel()">
            {{ selectedLabel() || placeholder() }}
          </span>
          @if (selectedLabel() && !isDisabled()) {
            <button
              type="button"
              class="combobox-clear"
              (click)="clearSingle($event)"
              aria-label="Limpiar selección"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
          <svg class="combobox-trigger__icon" [class.combobox-trigger__icon--open]="isOpen()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        @if (isOpen()) {
          <div class="combobox-dropdown" role="listbox" [attr.aria-label]="ariaLabel()" [style]="dropdownStyle()">
            @if (showSearch()) {
              <div class="combobox-search-wrapper">
                <input
                  #searchInput
                  type="text"
                  class="combobox-search"
                  [placeholder]="'Buscar...'"
                  [value]="searchTerm()"
                  (input)="onSearch($event)"
                  (keydown)="onSearchKeydown($event)"
                  aria-label="Buscar opciones"
                />
              </div>
            }
            <ul class="combobox-options">
              @for (opt of filteredOptions(); track opt.value; let i = $index) {
                <li
                  class="combobox-option"
                  [class.combobox-option--active]="i === activeIndex()"
                  [class.combobox-option--selected]="isSelected(opt.value)"
                  [attr.aria-selected]="isSelected(opt.value)"
                  role="option"
                  (click)="selectSingle(opt)"
                  (mouseenter)="activeIndex.set(i)"
                >
                  {{ opt.label }}
                </li>
              } @empty {
                <li class="combobox-empty">Sin resultados</li>
              }
            </ul>
          </div>
        }
      </div>
    }

    <!-- Multi select -->
    @if (multiple()) {
      <div class="combobox-wrapper">
        <button
          type="button"
          class="combobox-trigger combobox-trigger--multi"
          [class.combobox-trigger--open]="isOpen()"
          [class.combobox-trigger--disabled]="isDisabled()"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-label]="ariaLabel()"
          [disabled]="isDisabled()"
          (click)="toggle()"
        >
          <span class="combobox-tags">
            @if (multiValues().length === 0) {
              <span class="combobox-trigger__placeholder">{{ placeholder() }}</span>
            } @else if (multiValues().length <= maxVisibleTags()) {
              @for (tag of selectedMultiLabels(); track tag) {
                <span class="combobox-tag">
                  {{ tag }}
                  <button
                    type="button"
                    class="combobox-tag__remove"
                    (click)="removeTag(tag, $event)"
                    [attr.aria-label]="'Quitar ' + tag"
                  >✕</button>
                </span>
              }
            } @else {
              <span class="combobox-tag combobox-tag--count">
                {{ multiValues().length }} seleccionados
              </span>
            }
          </span>
          @if (multiValues().length > 0 && !isDisabled()) {
            <button
              type="button"
              class="combobox-clear"
              (click)="clearMulti($event)"
              aria-label="Limpiar selección"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
          <svg class="combobox-trigger__icon" [class.combobox-trigger__icon--open]="isOpen()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        @if (isOpen()) {
          <div class="combobox-dropdown" role="listbox" [attr.aria-multiselectable]="'true'" [attr.aria-label]="ariaLabel()" [style]="dropdownStyle()">
            @if (showSearch()) {
              <div class="combobox-search-wrapper">
                <input
                  #searchInput
                  type="text"
                  class="combobox-search"
                  placeholder="Buscar..."
                  [value]="searchTerm()"
                  (input)="onSearch($event)"
                  (keydown)="onSearchKeydown($event)"
                  aria-label="Buscar opciones"
                />
              </div>
            }
            <div class="combobox-select-all" (click)="toggleSelectAll()">
              <span class="combobox-check" [class.combobox-check--checked]="allSelected()" [class.combobox-check--partial]="someSelected()">
                @if (allSelected()) {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                } @else if (someSelected()) {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="6" y1="12" x2="18" y2="12"/>
                  </svg>
                }
              </span>
              {{ allSelected() ? 'Deseleccionar todos' : 'Seleccionar todos' }}
            </div>
            <ul class="combobox-options">
              @for (opt of filteredOptions(); track opt.value; let i = $index) {
                <li
                  class="combobox-option combobox-option--multi"
                  [class.combobox-option--active]="i === activeIndex()"
                  [class.combobox-option--selected]="isSelected(opt.value)"
                  [attr.aria-selected]="isSelected(opt.value)"
                  role="option"
                  (click)="toggleMulti(opt)"
                  (mouseenter)="activeIndex.set(i)"
                >
                  <span class="combobox-check" [class.combobox-check--checked]="isSelected(opt.value)">
                    @if (isSelected(opt.value)) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    }
                  </span>
                  {{ opt.label }}
                </li>
              } @empty {
                <li class="combobox-empty">Sin resultados</li>
              }
            </ul>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .combobox-wrapper {
      position: relative;
    }

    .combobox-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 2.375rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      background: white;
      border: 1px solid var(--color-ucb-gray-300);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      text-align: left;
      color: var(--color-ucb-gray-900);
      gap: 0.5rem;
    }

    .combobox-trigger:hover:not(:disabled) {
      border-color: var(--color-ucb-gray-400);
    }

    .combobox-trigger:focus {
      outline: none;
      border-color: var(--color-ucb-primary);
      box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
    }

    .combobox-trigger--open {
      border-color: var(--color-ucb-primary);
      box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
    }

    .combobox-trigger--disabled {
      background-color: var(--color-ucb-gray-100);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .combobox-trigger__text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .combobox-trigger__placeholder {
      color: var(--color-ucb-gray-500);
    }

    .combobox-trigger__icon {
      flex-shrink: 0;
      color: var(--color-ucb-gray-400);
      transition: transform 0.2s ease;
    }

    .combobox-trigger__icon--open {
      transform: rotate(180deg);
    }

    /* Dropdown */
    .combobox-dropdown {
      position: absolute;
      z-index: 1100;
      background: white;
      border: 1px solid var(--color-ucb-gray-200);
      border-radius: 0.5rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      animation: comboboxFadeIn 0.15s ease;
      overflow: hidden;
    }

    .combobox-search-wrapper {
      padding: 0.5rem;
      border-bottom: 1px solid var(--color-ucb-gray-100);
    }

    .combobox-search {
      width: 100%;
      padding: 0.4rem 0.6rem;
      font-size: 0.8125rem;
      border: 1px solid var(--color-ucb-gray-200);
      border-radius: 0.375rem;
      outline: none;
      background: var(--color-ucb-gray-50);
      transition: border-color 0.15s ease;
    }

    .combobox-search:focus {
      border-color: var(--color-ucb-primary);
      background: white;
    }

    .combobox-options {
      list-style: none;
      margin: 0;
      padding: 0.25rem 0;
      max-height: 220px;
      overflow-y: auto;
    }

    .combobox-option {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      transition: background-color 0.1s ease;
      color: var(--color-ucb-gray-800);
    }

    .combobox-option--active {
      background-color: var(--color-ucb-gray-50);
    }

    .combobox-option--selected {
      color: var(--color-ucb-primary);
      font-weight: 600;
    }

    .combobox-option--selected:not(.combobox-option--multi) {
      background-color: rgba(0, 51, 102, 0.04);
    }

    .combobox-empty {
      padding: 0.75rem;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--color-ucb-gray-500);
    }

    /* Multi - Tags */
    .combobox-trigger--multi {
      flex-wrap: wrap;
      min-height: 2.375rem;
      padding: 0.25rem 0.5rem;
      gap: 0.25rem;
    }

    .combobox-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      flex: 1;
      align-items: center;
    }

    .combobox-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 500;
      background: rgba(0, 51, 102, 0.08);
      color: var(--color-ucb-primary);
      border-radius: 0.25rem;
      line-height: 1.5;
    }

    .combobox-tag__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.625rem;
      color: var(--color-ucb-primary);
      padding: 0;
      line-height: 1;
      opacity: 0.7;
    }

    .combobox-tag__remove:hover {
      opacity: 1;
    }

    .combobox-tag--count {
      cursor: default;
    }

    /* Clear button */
    .combobox-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--color-ucb-gray-400);
      padding: 0.125rem;
      border-radius: 0.25rem;
      flex-shrink: 0;
      transition: color 0.15s ease, background-color 0.15s ease;
    }

    .combobox-clear:hover {
      color: var(--color-ucb-gray-700);
      background-color: var(--color-ucb-gray-100);
    }

    /* Select all */
    .combobox-select-all {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-ucb-primary);
      cursor: pointer;
      border-bottom: 1px solid var(--color-ucb-gray-100);
      transition: background-color 0.1s ease;
    }

    .combobox-select-all:hover {
      background-color: var(--color-ucb-gray-50);
    }

    /* Multi - Checkbox */
    .combobox-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
      border: 1.5px solid var(--color-ucb-gray-300);
      border-radius: 0.25rem;
      margin-right: 0.5rem;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .combobox-check--checked {
      background: var(--color-ucb-primary);
      border-color: var(--color-ucb-primary);
      color: white;
    }

    .combobox-check--partial {
      background: var(--color-ucb-primary);
      border-color: var(--color-ucb-primary);
      color: white;
    }

    @keyframes comboboxFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
})
export class Combobox implements ControlValueAccessor, OnDestroy {
  private readonly elRef = inject(ElementRef);

  /** The available options */
  readonly options = input<ComboboxOption[]>([]);

  /** Placeholder text when nothing selected */
  readonly placeholder = input('— Seleccionar —');

  /** Enable multi-select mode */
  readonly multiple = input(false);

  /** Minimum number of options to show the search input (default 10) */
  readonly searchThreshold = input(10);

  /** Aria label for the combobox */
  readonly ariaLabel = input('');

  /** Max visible tags before collapsing to "N seleccionados" (default 2) */
  readonly maxVisibleTags = input(2);

  /** Emitted whenever the search term changes (single-select mode) */
  readonly searchChange = output<string>();

  // Internal state
  protected readonly isOpen = signal(false);
  protected readonly dropdownStyle = signal<Record<string, string>>({});
  protected readonly searchTerm = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly isDisabled = signal(false);

  // Single value
  private readonly singleValue = signal<string | number | null>(null);

  // Multi value
  protected readonly multiValues = signal<(string | number)[]>([]);

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  /** Whether to show the search input */
  protected readonly showSearch = computed(() => this.options().length > this.searchThreshold());

  /** Filtered options based on search */
  protected readonly filteredOptions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.options();
    return this.options().filter(o => o.label.toLowerCase().includes(term));
  });

  /** Label of the currently selected single option */
  protected readonly selectedLabel = computed(() => {
    const val = this.singleValue();
    if (val == null || val === '') return '';
    const opt = this.options().find(o => String(o.value) === String(val));
    return opt?.label ?? '';
  });

  /** Labels for multi-select tags */
  protected readonly selectedMultiLabels = computed(() => {
    const vals = this.multiValues();
    return vals
      .map(v => this.options().find(o => String(o.value) === String(v))?.label)
      .filter((l): l is string => !!l);
  });

  /** Whether all filtered options are selected */
  protected readonly allSelected = computed(() => {
    const opts = this.filteredOptions();
    if (opts.length === 0) return false;
    return opts.every(o => this.multiValues().some(v => String(v) === String(o.value)));
  });

  /** Whether some (but not all) filtered options are selected */
  protected readonly someSelected = computed(() => {
    const opts = this.filteredOptions();
    const selected = opts.filter(o => this.multiValues().some(v => String(v) === String(o.value)));
    return selected.length > 0 && selected.length < opts.length;
  });

  // ControlValueAccessor
  writeValue(value: unknown): void {
    if (this.multiple()) {
      this.multiValues.set(Array.isArray(value) ? value : []);
    } else {
      this.singleValue.set(value as string | number | null);
    }
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }

  private computeDropdownPosition(): void {
    const el = this.elRef.nativeElement as HTMLElement;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const style: Record<string, string> = { left: '0', right: '0' };
    if (spaceBelow < 300 && rect.top > spaceBelow) {
      style['bottom'] = 'calc(100% + 4px)';
      style['top'] = 'auto';
    } else {
      style['top'] = 'calc(100% + 4px)';
      style['bottom'] = 'auto';
    }
    this.dropdownStyle.set(style);
  }

  // Public API
  protected toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.computeDropdownPosition();
      this.searchTerm.set('');
      this.activeIndex.set(0);
    } else {
      this.onTouched();
    }
  }

  protected selectSingle(opt: ComboboxOption): void {
    this.singleValue.set(opt.value);
    this.onChange(opt.value);
    this.isOpen.set(false);
    this.searchTerm.set('');
    this.onTouched();
  }

  protected clearSingle(event: MouseEvent): void {
    event.stopPropagation();
    this.singleValue.set(null);
    this.onChange(null);
    this.onTouched();
  }

  protected clearMulti(event: MouseEvent): void {
    event.stopPropagation();
    this.multiValues.set([]);
    this.onChange([]);
    this.onTouched();
  }

  protected toggleSelectAll(): void {
    const opts = this.filteredOptions();
    if (this.allSelected()) {
      // Deselect all filtered options
      const filteredValues = new Set(opts.map(o => String(o.value)));
      const remaining = this.multiValues().filter(v => !filteredValues.has(String(v)));
      this.multiValues.set(remaining);
      this.onChange(remaining);
    } else {
      // Select all filtered options (merge with existing)
      const currentSet = new Set(this.multiValues().map(v => String(v)));
      const newValues = [...this.multiValues()];
      for (const o of opts) {
        if (!currentSet.has(String(o.value))) {
          newValues.push(o.value);
        }
      }
      this.multiValues.set(newValues);
      this.onChange(newValues);
    }
  }

  protected toggleMulti(opt: ComboboxOption): void {
    this.multiValues.update(vals => {
      const exists = vals.some(v => String(v) === String(opt.value));
      const next = exists
        ? vals.filter(v => String(v) !== String(opt.value))
        : [...vals, opt.value];
      this.onChange(next);
      return next;
    });
  }

  protected removeTag(label: string, event: MouseEvent): void {
    event.stopPropagation();
    const opt = this.options().find(o => o.label === label);
    if (opt) {
      this.toggleMulti(opt);
    }
  }

  protected isSelected(value: string | number): boolean {
    if (this.multiple()) {
      return this.multiValues().some(v => String(v) === String(value));
    }
    return String(this.singleValue()) === String(value);
  }

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.activeIndex.set(0);
    this.searchChange.emit(input.value);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + 1, opts.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (opts[this.activeIndex()]) {
          if (this.multiple()) {
            this.toggleMulti(opts[this.activeIndex()]);
          } else {
            this.selectSingle(opts[this.activeIndex()]);
          }
        }
        break;
      case 'Escape':
        this.isOpen.set(false);
        this.onTouched();
        break;
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      if (this.isOpen()) {
        this.isOpen.set(false);
        this.onTouched();
      }
    }
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  ngOnDestroy(): void {
    // Cleanup handled by Angular host listener removal
  }
}
