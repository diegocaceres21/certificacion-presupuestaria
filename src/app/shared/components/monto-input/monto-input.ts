import {
  Component,
  ChangeDetectionStrategy,
  signal,
  forwardRef,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Numeric input with live `#.###,##` formatting (e.g. 1.234.567,89).
 * The decimal separator is always visible while editing, identical to
 * PrimeNG InputNumber with minFractionDigits=2 / maxFractionDigits=2.
 * The model value is always a plain `number`.
 */
@Component({
  selector: 'app-monto-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MontoInput),
      multi: true,
    },
  ],
  template: `
    <input
      #inputEl
      type="text"
      inputmode="decimal"
      class="monto-input"
      [disabled]="isDisabled()"
      (keydown)="onKeydown($event)"
      (blur)="onBlur()"
      placeholder="0,00"
    />
  `,
  styles: `
    :host { display: block; }
    .monto-input { width: 100%; }
  `,
})
export class MontoInput implements ControlValueAccessor, AfterViewInit {
  private readonly inputElRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly isDisabled = signal(false);

  private pendingValue: number | null = null;
  private viewInitialized = false;

  private onChange: (v: number) => void = () => {};
  private onTouched: () => void = () => {};

  // ─── Formatting helpers ───────────────────────────────────────────────────

  /** Format integer + decimal parts into `#.###,##`. */
  private formatParts(intDigits: string, decDigits: string): string {
    // intDigits may be empty ('') → show nothing before comma
    const intFormatted = intDigits === ''
      ? ''
      : intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decDigits}`;
  }

  /** Format a JS number into `#.###,##`. */
  private formatNumber(value: number): string {
    const [intStr, decStr] = value.toFixed(2).split('.');
    return this.formatParts(intStr, decStr);
  }

  // ─── Key-by-key handling (mirrors PrimeNG InputNumber) ───────────────────

  protected onKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    // Allow: navigation, clipboard, modifiers
    if (
      event.ctrlKey || event.metaKey ||
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
       'Home', 'End', 'Tab', 'Enter'].includes(key)
    ) {
      return;
    }

    // Block any character that is not a digit, comma, or backspace/delete
    if (!/^\d$/.test(key) && key !== ',' && key !== 'Backspace' && key !== 'Delete') {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const { value } = input;
    const selStart = input.selectionStart ?? value.length;
    const selEnd   = input.selectionEnd   ?? value.length;

    // Parse current display into raw integer and decimal string parts
    const { intDigits, decDigits } = this.parseDisplay(value);

    if (key === 'Backspace' || key === 'Delete') {
      this.handleDelete(input, key, value, selStart, selEnd, intDigits, decDigits);
      return;
    }

    if (key === ',') {
      // Move cursor to the start of the decimal section so the user can overwrite it
      this.applyFormat(input, intDigits, decDigits, intDigits.length, 0);
      return;
    }

    // It's a digit — figure out where in the number to insert it
    this.handleDigit(input, key, value, selStart, selEnd, intDigits, decDigits);
  }

  /**
   * Parse the displayed string into raw integer and decimal digit strings.
   * e.g. "1.234,56" → { intDigits: "1234", decDigits: "56" }
   */
  private parseDisplay(display: string): { intDigits: string; decDigits: string } {
    const commaIdx = display.indexOf(',');
    if (commaIdx === -1) {
      return { intDigits: display.replace(/\D/g, ''), decDigits: '00' };
    }
    const intDigits = display.slice(0, commaIdx).replace(/\D/g, '');
    const decDigits = display.slice(commaIdx + 1).replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    return { intDigits, decDigits };
  }

  /**
   * Insert a digit at the right place and reformat.
   * Cursor position relative to the comma determines whether the digit
   * goes into the integer or decimal part.
   */
  private handleDigit(
    input: HTMLInputElement,
    digit: string,
    display: string,
    selStart: number,
    selEnd: number,
    intDigits: string,
    decDigits: string,
  ): void {
    const commaIdx = display.indexOf(',');

    // Is cursor on the integer side (before or at comma)?
    const inIntegerPart = commaIdx === -1 || selStart <= commaIdx;

    if (inIntegerPart) {
      // Count digits before cursor position in the integer part
      const intSection = commaIdx === -1 ? display : display.slice(0, commaIdx);
      const digitsBeforeCursor = (intSection.slice(0, selStart).match(/\d/g) ?? []).length;

      // Delete selected range from integer digits first
      let newInt = intDigits;
      if (selEnd > selStart) {
        const intEndIdx = commaIdx === -1 ? selEnd : Math.min(selEnd, commaIdx);
        const digitsInSelection = (display.slice(selStart, intEndIdx).match(/\d/g) ?? []).length;
        newInt = intDigits.slice(0, digitsBeforeCursor) + intDigits.slice(digitsBeforeCursor + digitsInSelection);
      }

      const newInt2 = newInt.slice(0, digitsBeforeCursor) + digit + newInt.slice(digitsBeforeCursor);
      const newCursorIntDigits = digitsBeforeCursor + 1;

      this.applyFormat(input, newInt2, decDigits, newCursorIntDigits);
    } else {
      // Cursor is in the decimal part
      const decSection = display.slice(commaIdx + 1);
      const decCursorIdx = selStart - commaIdx - 1; // position within decSection
      const digits = decSection.replace(/\D/g, '');

      // Which decimal digit position (0 or 1) the cursor is at
      const decPos = Math.min(decCursorIdx, 2);

      // Replace at decPos, shift remaining
      let newDec = digits.slice(0, decPos) + digit + digits.slice(decPos, 2);
      newDec = newDec.slice(0, 2).padEnd(2, '0');

      const newCursorDecPos = Math.min(decPos + 1, 2);
      this.applyFormat(input, intDigits, newDec, intDigits.length, newCursorDecPos);
    }
  }

  private handleDelete(
    input: HTMLInputElement,
    key: string,
    display: string,
    selStart: number,
    selEnd: number,
    intDigits: string,
    decDigits: string,
  ): void {
    const commaIdx = display.indexOf(',');
    const hasSelection = selEnd > selStart;

    if (hasSelection) {
      // Remove selected digits from integer and/or decimal parts
      const intSectionEnd = commaIdx === -1 ? display.length : commaIdx;
      const selIntStart = Math.min(selStart, intSectionEnd);
      const selIntEnd   = Math.min(selEnd,   intSectionEnd);
      const selDecStart = commaIdx === -1 ? 0 : Math.max(selStart - commaIdx - 1, 0);
      const selDecEnd   = commaIdx === -1 ? 0 : Math.max(selEnd   - commaIdx - 1, 0);

      const digitsRemovedFromInt = (display.slice(selIntStart, selIntEnd).match(/\d/g) ?? []).length;
      const cursorIntDigits = (display.slice(0, selIntStart).replace(/\D/g, '')).length;

      const newInt = intDigits.slice(0, cursorIntDigits) + intDigits.slice(cursorIntDigits + digitsRemovedFromInt);
      const newDec = decDigits.slice(0, selDecStart) + '0'.repeat(Math.min(selDecEnd - selDecStart, 2)) + decDigits.slice(selDecEnd);

      this.applyFormat(input, newInt, newDec.slice(0, 2).padEnd(2, '0'), cursorIntDigits);
      return;
    }

    // No selection — delete a single digit
    const cursorInInteger = commaIdx === -1 || selStart <= commaIdx;

    if (cursorInInteger) {
      // How many raw integer digits are to the left of the cursor
      const intSection = commaIdx === -1 ? display : display.slice(0, commaIdx);
      const sliceLen = key === 'Delete' ? selStart : selStart - 1;
      const digitsLeft = (intSection.slice(0, Math.max(sliceLen, 0)).match(/\d/g) ?? []).length;

      if (key === 'Backspace' && digitsLeft === 0) return; // nothing to delete
      const newInt = key === 'Backspace'
        ? intDigits.slice(0, digitsLeft - 1) + intDigits.slice(digitsLeft)
        : intDigits.slice(0, digitsLeft) + intDigits.slice(digitsLeft + 1);

      const newCursorIntDigits = key === 'Backspace' ? Math.max(digitsLeft - 1, 0) : digitsLeft;
      this.applyFormat(input, newInt, decDigits, newCursorIntDigits);
    } else {
      // Cursor is in decimal part — replace deleted digit with '0'
      const decSection = display.slice(commaIdx + 1);
      const decCursorIdx = selStart - commaIdx - 1;
      const decPos = key === 'Backspace' ? decCursorIdx - 1 : decCursorIdx;

      if (decPos < 0 || decPos >= 2) {
        // Backspace at the comma — move cursor there, nothing deleted
        this.applyFormat(input, intDigits, decDigits, intDigits.length);
        return;
      }

      const digits = decSection.replace(/\D/g, '').padEnd(2, '0');
      const newDec = digits.slice(0, decPos) + '0' + digits.slice(decPos + 1);
      const newCursorDecPos = key === 'Backspace' ? decPos : decPos + 1;
      this.applyFormat(input, intDigits, newDec, intDigits.length, newCursorDecPos);
    }
  }

  /**
   * Apply formatted string to the input and position the cursor.
   * @param cursorIntDigits — how many integer digits should be to the left of cursor
   * @param cursorDecPos — if provided, cursor is in the decimal part at this 0-based position
   */
  private applyFormat(
    input: HTMLInputElement,
    intDigits: string,
    decDigits: string,
    cursorIntDigits: number,
    cursorDecPos?: number,
  ): void {
    const formatted = this.formatParts(intDigits, decDigits);
    input.value = formatted;
    this.emitValue(intDigits, decDigits);

    // Calculate cursor position
    let newCursor: number;
    if (cursorDecPos !== undefined) {
      // Place cursor in decimal section: find comma + offset
      const commaPos = formatted.indexOf(',');
      newCursor = commaPos + 1 + cursorDecPos;
    } else {
      // Place cursor after the Nth integer digit, skipping thousands separators
      let count = 0;
      newCursor = formatted.indexOf(','); // fallback: right before comma
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] === ',') break;
        if (/\d/.test(formatted[i])) {
          count++;
          if (count === cursorIntDigits) {
            newCursor = i + 1;
            break;
          }
        }
      }
      if (cursorIntDigits === 0) newCursor = 0;
    }

    input.setSelectionRange(newCursor, newCursor);
  }

  private emitValue(intDigits: string, decDigits: string): void {
    if (intDigits === '' && decDigits === '00') {
      this.onChange(0);
      return;
    }
    const num = parseFloat((intDigits || '0') + '.' + decDigits);
    this.onChange(isFinite(num) ? num : 0);
  }

  // ─── Blur ─────────────────────────────────────────────────────────────────

  protected onBlur(): void {
    const el = this.inputElRef().nativeElement;
    const clean = el.value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);

    if (isFinite(num) && num > 0) {
      el.value = this.formatNumber(num);
      this.onChange(num);
    } else {
      el.value = '';
      this.onChange(0);
    }

    this.onTouched();
  }

  // ─── ControlValueAccessor ─────────────────────────────────────────────────

  writeValue(value: number): void {
    const display = value != null && isFinite(value) && value > 0
      ? this.formatNumber(value)
      : '';

    if (this.viewInitialized) {
      this.inputElRef().nativeElement.value = display;
    } else {
      this.pendingValue = value;
    }
  }

  registerOnChange(fn: (v: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.pendingValue !== null) {
      this.writeValue(this.pendingValue);
      this.pendingValue = null;
    }
  }
}
