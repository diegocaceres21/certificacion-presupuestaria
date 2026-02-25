import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  ElementRef,
  inject,
  afterNextRender,
} from '@angular/core';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (open()) {
      <div
        class="modal-overlay"
        (click)="onOverlayClick($event)"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel() || title()"
      >
        <div class="modal-content" [style.max-width]="maxWidth()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ title() }}</h3>
            <button type="button" class="btn-icon" (click)="closed.emit()" aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <ng-content />
          </div>
          <ng-content select="[modalFooter]" />
        </div>
      </div>
    }
  `,
})
export class Modal {
  private readonly elRef = inject(ElementRef);

  readonly open = input.required<boolean>();
  readonly title = input('');
  readonly ariaLabel = input('');
  readonly maxWidth = input('600px');

  readonly closed = output<void>();

  constructor() {
    // Focus trap: when modal opens, focus the first focusable element
    afterNextRender(() => {
      if (this.open()) {
        this.trapFocus();
      }
    });
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closed.emit();
    }
  }

  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  private trapFocus(): void {
    const el = this.elRef.nativeElement as HTMLElement;
    const focusable = el.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }
}
