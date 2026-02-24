import { Component, input, output, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CertificacionDetalle, ObservacionDetalle, ModificacionDetalle } from '../../../core/models';
import { ObservacionService } from '../../../core/services/observacion.service';
import { ModificacionService } from '../../../core/services/modificacion.service';
import { PrintCertificacion } from '../../../shared/components/print-certificacion/print-certificacion';

@Component({
  selector: 'app-detalle-certificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrintCertificacion],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)" role="dialog" aria-modal="true" aria-label="Detalle de certificación">
      <div class="modal-content" style="max-width: 850px" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Detalle de Certificación {{ certificacion().nro_certificacion }}/{{ certificacion().anio_certificacion }}</h2>
          <button class="btn-icon" (click)="cerrar.emit()" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="padding: 0">
          <app-print-certificacion
            [certificacion]="certificacion()"
            [observaciones]="observaciones()"
            [modificaciones]="modificaciones()"
            [modo]="'vista'"
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="cerrar.emit()">Cerrar</button>
          <button class="btn btn-primary" (click)="imprimir()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DetalleCertificacion implements OnInit {
  readonly certificacion = input.required<CertificacionDetalle>();
  readonly cerrar = output<void>();

  private readonly obsService = inject(ObservacionService);
  private readonly modService = inject(ModificacionService);

  protected readonly observaciones = signal<ObservacionDetalle[]>([]);
  protected readonly modificaciones = signal<ModificacionDetalle[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const [obs, mods] = await Promise.all([
        this.obsService.listar(this.certificacion().id),
        this.modService.listar(this.certificacion().id),
      ]);
      this.observaciones.set(obs);
      this.modificaciones.set(mods);
    } catch {
      // silently ignore if no history available
    }
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cerrar.emit();
    }
  }

  protected imprimir(): void {
    window.print();
  }
}
