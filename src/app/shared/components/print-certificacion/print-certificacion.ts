import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CertificacionDetalle, ObservacionDetalle, ModificacionDetalle } from '../../../core/models';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-print-certificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="cert-print" [class.cert-print--vista]="modo() === 'vista'">
      <!-- Header -->
      <div class="cert-header">
        <div class="cert-logo">
          <img src="logo-ucb.png" alt="Logo UCB" width="90" height="90" />
        </div>
        <div class="cert-title-block">
          <h1 class="cert-university">Universidad Católica Boliviana "San Pablo"</h1>
          <h2 class="cert-sede">Unidad Académica Regional Cochabamba</h2>
          <h3 class="cert-dept">Departamento Administrativo Financiero</h3>
        </div>
      </div>

      <hr class="cert-divider" />

      <!-- Certificate number & date -->
      <div class="cert-meta">
        <div class="cert-number">
          <strong>CERTIFICACIÓN PRESUPUESTARIA N°</strong>
          <span class="cert-nro">{{ certificacion().nro_certificacion }}/{{ certificacion().anio_certificacion }}</span>
        </div>
        <div class="cert-date">
          <strong>Fecha:</strong> {{ certificacion().fecha_certificacion | date:'dd/MM/yyyy' }}
        </div>
      </div>

      <!-- Body -->
      <div class="cert-body">
        <table class="cert-fields" aria-label="Datos de la certificación">
          <tbody>
            <tr>
              <th scope="row">Unidad Organizacional:</th>
              <td>{{ certificacion().unidad_codigo }} — {{ certificacion().unidad_nombre }}</td>
            </tr>
            <tr>
              <th scope="row">Cuenta Contable:</th>
              <td>{{ certificacion().cuenta_codigo }} — {{ certificacion().cuenta_nombre }}</td>
            </tr>
            @if (certificacion().proyecto_nombre) {
              <tr>
                <th scope="row">Proyecto:</th>
                <td>
                  {{ certificacion().proyecto_nombre }}
                  @if (certificacion().proyecto_pei) {
                    <span class="cert-pei">(PEI: {{ certificacion().proyecto_pei }})</span>
                  }
                </td>
              </tr>
            }
            <tr>
              <th scope="row">Concepto:</th>
              <td class="cert-concepto">{{ certificacion().concepto }}</td>
            </tr>
            <tr>
              <th scope="row">Importe Total (Bs):</th>
              <td class="cert-monto">{{ certificacion().monto_total | number:'1.2-2' }}</td>
            </tr>
            @if (certificacion().comentario) {
              <tr>
                <th scope="row">Comentario:</th>
                <td>{{ certificacion().comentario }}</td>
              </tr>
            }
            <tr>
              <th scope="row">Generado por:</th>
              <td>{{ certificacion().generado_por_nombre }} — {{ certificacion().generado_por_cargo }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Observaciones -->
      @if (observaciones().length > 0) {
        <div class="cert-section">
          <h4 class="cert-section-title">Observaciones</h4>
          <table class="cert-obs-table" aria-label="Observaciones">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Autor</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              @for (obs of observaciones(); track obs.id) {
                <tr>
                  <td>{{ obs.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ obs.creado_por_nombre }}</td>
                  <td>{{ obs.comentario }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Historial de Modificaciones -->
      @if (modificaciones().length > 0) {
        <div class="cert-section">
          <h4 class="cert-section-title">Historial de Modificaciones</h4>
          <table class="cert-obs-table" aria-label="Historial de modificaciones">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Modificado por</th>
                <th>Cambios</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              @for (mod of modificaciones(); track mod.id) {
                <tr>
                  <td>{{ mod.fecha_hora | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ mod.modificado_por_nombre }}</td>
                  <td>
                    @if (mod.monto_antiguo && mod.monto_nuevo) {
                      <div>Monto: {{ mod.monto_antiguo | number:'1.2-2' }} → {{ mod.monto_nuevo | number:'1.2-2' }}</div>
                    }
                    @if (mod.concepto_antiguo && mod.concepto_nuevo) {
                      <div>Concepto modificado</div>
                    }
                  </td>
                  <td>{{ mod.comentario ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Signature block -->
      <div class="cert-signatures">
        <div class="cert-sig-block">
          <div class="cert-sig-line"></div>
          <p class="cert-sig-label">Elaborado por</p>
          <p class="cert-sig-name">{{ certificacion().generado_por_nombre }}</p>
          <p class="cert-sig-cargo">{{ certificacion().generado_por_cargo }}</p>
        </div>
        <div class="cert-sig-block">
          <div class="cert-sig-line"></div>
          <p class="cert-sig-label">Visto Bueno</p>
          <p class="cert-sig-name">&nbsp;</p>
          <p class="cert-sig-cargo">Director(a) Administrativo Financiero</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="cert-footer">
        <p>Este documento es una certificación presupuestaria emitida por la UCB "San Pablo" – Regional Cochabamba.</p>
      </div>
    </div>
  `,
  styles: `
    .cert-print--vista {
      padding: 2rem;
    }

    .cert-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .cert-logo img {
      display: block;
    }

    .cert-title-block {
      flex: 1;
    }

    .cert-university {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--color-ucb-primary);
      margin: 0;
    }

    .cert-sede {
      font-size: 1rem;
      font-weight: 600;
      margin: 0.15rem 0 0;
    }

    .cert-dept {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-gray-600);
      margin: 0.15rem 0 0;
    }

    .cert-divider {
      border: none;
      border-top: 2px solid var(--color-ucb-primary);
      margin: 1rem 0;
    }

    .cert-meta {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1.5rem;
    }

    .cert-nro {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-ucb-secondary);
      margin-left: 0.5rem;
    }

    .cert-fields {
      width: 100%;
      border-collapse: collapse;
    }

    .cert-fields th {
      text-align: left;
      width: 220px;
      padding: 0.5rem 0.75rem;
      vertical-align: top;
      font-weight: 600;
      color: var(--color-gray-700);
      border-bottom: 1px solid var(--color-gray-200);
    }

    .cert-fields td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--color-gray-200);
    }

    .cert-concepto {
      white-space: pre-wrap;
    }

    .cert-monto {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--color-ucb-primary);
    }

    .cert-pei {
      font-size: 0.85rem;
      color: var(--color-gray-500);
    }

    .cert-section {
      margin-top: 1.5rem;
    }

    .cert-section-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-ucb-primary);
      margin: 0 0 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--color-ucb-primary);
    }

    .cert-obs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .cert-obs-table th {
      text-align: left;
      padding: 0.4rem 0.5rem;
      background: var(--color-gray-100);
      border-bottom: 1px solid var(--color-gray-300);
      font-weight: 600;
    }

    .cert-obs-table td {
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid var(--color-gray-200);
    }

    .cert-signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 3rem;
      gap: 2rem;
    }

    .cert-sig-block {
      text-align: center;
      min-width: 220px;
    }

    .cert-sig-line {
      border-bottom: 1px solid var(--color-gray-800);
      margin-bottom: 0.35rem;
      min-width: 200px;
    }

    .cert-sig-label {
      font-size: 0.8rem;
      color: var(--color-gray-500);
      margin: 0;
    }

    .cert-sig-name {
      font-weight: 600;
      margin: 0.15rem 0 0;
    }

    .cert-sig-cargo {
      font-size: 0.85rem;
      color: var(--color-gray-600);
      margin: 0;
    }

    .cert-footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--color-gray-400);
      border-top: 1px solid var(--color-gray-200);
      padding-top: 0.75rem;
    }
  `,
})
export class PrintCertificacion {
  readonly certificacion = input.required<CertificacionDetalle>();
  readonly observaciones = input<ObservacionDetalle[]>([]);
  readonly modificaciones = input<ModificacionDetalle[]>([]);
  readonly modo = input<'vista' | 'impresion'>('impresion');
}
