import { Component, input, output, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CertificacionDetalle, ObservacionDetalle, ModificacionDetalle } from '../../../core/models';
import { ObservacionService } from '../../../core/services/observacion.service';
import { ModificacionService } from '../../../core/services/modificacion.service';
import { PrintCertificacion } from '../../../shared/components/print-certificacion/print-certificacion';
import { Modal } from '../../../shared/components/modal/modal';

@Component({
  selector: 'app-detalle-certificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrintCertificacion, Modal],
  template: `
    <app-modal [open]="true" [title]="'Detalle de Certificación ' + certificacion().nro_certificacion + '/' + certificacion().anio_certificacion" ariaLabel="Detalle de certificación" maxWidth="850px" (closed)="cerrar.emit()">
      <app-print-certificacion
        [certificacion]="certificacion()"
        [observaciones]="observaciones()"
        [modificaciones]="modificaciones()"
        [modo]="'vista'"
      />
      <div modalFooter class="modal-footer">
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
    </app-modal>
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

  protected imprimir(): void {
    window.print();
  }
}
