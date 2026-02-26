import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CertificacionDetalle, ObservacionDetalle, ModificacionDetalle } from '../../../core/models';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-print-certificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="cert-print" [class.cert-print--vista]="modo() === 'vista'">

      <!-- ═══ ENCABEZADO ═══ -->
      <header class="cp-header">
        <div class="cp-logo">
          <img src="logo-ucb.png" alt="Logo UCB" width="62" height="62" />
        </div>
        <div class="cp-header-text">
          <p class="cp-univ">UNIVERSIDAD CATÓLICA BOLIVIANA "SAN PABLO"</p>
          <p class="cp-sede">Sede Cochabamba</p>
        </div>
        <div class="cp-header-meta">
          <p class="cp-meta-nro"><b>N° {{ certificacion().nro_certificacion }}/{{ certificacion().anio_certificacion }}</b></p>
          <p class="cp-meta-fecha">Fecha: {{ certificacion().fecha_certificacion | date:'dd/MM/yyyy' }}</p>
        </div>
      </header>

      <!-- ═══ TÍTULO PRINCIPAL ═══ -->
      <div class="cp-title-bar">
        <h1>CERTIFICACIÓN PRESUPUESTARIA</h1>
      </div>

      <!-- ═══ DATOS ═══ -->
      <section class="cp-fields" aria-label="Datos de la certificación">

        <div class="cp-row">
            <div class="cp-field" style="flex: 2">
              <span class="cp-label">Indicador</span>
              <span class="cp-value">PO (PLAN OPERATIVO)</span>
            </div>
        </div>

                <!-- Concepto -->
        <div class="cp-row">
          <div class="cp-field cp-field--full">
            <span class="cp-label">Concepto</span>
            <span class="cp-value cp-concepto">{{ certificacion().concepto }}</span>
          </div>
        </div>

        <!-- Unidad -->
        <div class="cp-row">
          <div class="cp-field cp-field--full">
            <span class="cp-label">Unidad Organizacional</span>
            <span class="cp-value">{{ certificacion().unidad_codigo }} — {{ certificacion().unidad_nombre }}</span>
          </div>
        </div>

        <!-- Cuenta -->
        <div class="cp-row">
          <div class="cp-field cp-field--full">
            <span class="cp-label">Cuenta Contable</span>
            <span class="cp-value">{{ certificacion().cuenta_codigo }} — {{ certificacion().cuenta_nombre }}</span>
          </div>
        </div>

        <!-- Proyecto + PEI en misma fila (solo si aplica) -->
        @if (certificacion().proyecto_nombre) {
          <div class="cp-row">
            <div class="cp-field" style="flex: 2">
              <span class="cp-label">Proyecto</span>
              <span class="cp-value">{{ certificacion().proyecto_nombre }}</span>
            </div>
            @if (certificacion().proyecto_pei) {
              <div class="cp-field" style="flex: 1">
                <span class="cp-label">Código PEI</span>
                <span class="cp-value">{{ certificacion().proyecto_pei }}</span>
              </div>
            }
          </div>
        }



        <!-- Importe -->
        <div class="cp-row cp-row--monto">
          <div class="cp-field cp-monto-field">
            <span class="cp-label">Importe Total</span>
          </div>
          <div class="cp-monto-value-wrap">
            <span class="cp-monto-value">Bs.&nbsp;{{ certificacion().monto_total | number:'1.2-2' }}</span>
          </div>
        </div>

        <!-- Comentario (opcional) -->
        @if (certificacion().comentario) {
          <div class="cp-row">
            <div class="cp-field cp-field--full">
              <span class="cp-label">Observaciones / Comentarios</span>
              <span class="cp-value">{{ certificacion().comentario }}</span>
            </div>
          </div>
        }

      </section>

      <!-- ═══ OBSERVACIONES ═══ -->
      <!-- @if (observaciones().length > 0) {
        <div class="cp-section">
          <h2 class="cp-section-title">Observaciones</h2>
          <table class="cp-table" aria-label="Observaciones">
            <thead>
              <tr>
                <th style="width: 110px">Fecha</th>
                <th style="width: 160px">Autor</th>
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
      } -->

      <!-- ═══ HISTORIAL DE MODIFICACIONES ═══ -->
      @if (modificaciones().length > 0) {
        <div class="cp-section">
          <h2 class="cp-section-title">Historial de Modificaciones</h2>
          <table class="cp-table" aria-label="Historial de modificaciones">
            <thead>
              <tr>
                <th style="width: 110px">Fecha</th>
                <th style="width: 150px">Modificado por</th>
                <th style="width: 170px">Cambios</th>
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
                      <span>El monto se ha modificado de: Bs. {{ mod.monto_antiguo | number:'1.2-2' }} a Bs. {{ mod.monto_nuevo | number:'1.2-2' }}.</span>
                    }
                    @if (mod.concepto_antiguo && mod.concepto_nuevo) {
                      <span>Se ha modificado el concepto de: {{ mod.concepto_antiguo }} a {{ mod.concepto_nuevo }}.</span>
                    }
                  </td>
                  <td>{{ mod.comentario ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ═══ FIRMA ═══ -->
      <div class="cp-signature">
        <div class="cp-sig-block">
          <div class="cp-sig-space"></div>
          <div class="cp-sig-line"></div>
          <p class="cp-sig-name">{{ certificacion().generado_por_nombre }}</p>
          <p class="cp-sig-cargo">{{ certificacion().generado_por_cargo }}</p>
        </div>
      </div>

    </div>
  `,
  styles: `
    /* ── Layout base ───────────────────────────────────────── */
    .cert-print {
      font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
      font-size: 9.5pt;
      color: #1a1a1a;
      line-height: 1.45;
      padding: 0;
      margin: 0 auto;
      max-width: 780px;
    }

    .cert-print--vista {
      padding: 1.25rem;
    }

    /* ── Encabezado ────────────────────────────────────────── */
    .cp-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.6rem;
      border-bottom: 3px solid #003366;
    }

    .cp-logo img {
      display: block;
      flex-shrink: 0;
    }

    .cp-header-text {
      flex: 1;
    }

    .cp-univ {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #003366;
      margin: 0;
    }

    .cp-sede {
      font-size: 8pt;
      color: #555;
      margin: 0.1rem 0 0;
    }

    .cp-header-meta {
      text-align: right;
      flex-shrink: 0;
    }

    .cp-meta-nro {
      font-size: 9pt;
      color: #003366;
      margin: 0;
    }

    .cp-meta-nro strong {
      font-size: 10.5pt;
    }

    .cp-meta-fecha {
      font-size: 9pt;
      color: #003366;
      margin: 0.15rem 0 0;
    }

    /* ── Título principal ──────────────────────────────────── */
    .cp-title-bar {
      background: #003366;
      color: #ffffff;
      text-align: center;
      padding: 0.45rem 0.75rem;
      margin-top: 0;
    }

    .cp-title-bar h1 {
      font-size: 11.5pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0;
    }

    /* ── Campos ────────────────────────────────────────────── */
    .cp-fields {
      border: 1px solid #bfc9d8;
      border-top: none;
    }

    .cp-row {
      display: flex;
      border-bottom: 1px solid #bfc9d8;
    }

    .cp-row:last-child {
      border-bottom: none;
    }

    .cp-field {
      padding: 0.38rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .cp-field + .cp-field {
      border-left: 1px solid #bfc9d8;
    }

    .cp-field--full {
      flex: 1;
    }

    .cp-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #003366;
    }

    .cp-value {
      font-size: 9.5pt;
    }

    .cp-concepto {
      white-space: pre-wrap;
    }

    /* ── Fila de Importe ───────────────────────────────────── */
    .cp-row--monto {
      background: #eef2f8;
      align-items: center;
      justify-content: space-between;
    }

    .cp-monto-field {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      border-bottom: none;
    }

    .cp-monto-field .cp-label {
      margin: 0;
    }

    .cp-monto-value-wrap {
      padding: 0.38rem 0.75rem;
    }

    .cp-monto-value {
      font-size: 13.5pt;
      font-weight: 700;
      color: #003366;
      letter-spacing: 0.02em;
    }

    /* ── Secciones (observaciones / modificaciones) ─────────── */
    .cp-section {
      margin-top: 0.7rem;
    }

    .cp-section-title {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #003366;
      border-bottom: 1.5px solid #003366;
      padding-bottom: 0.2rem;
      margin: 0 0 0.3rem;
    }

    .cp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }

    .cp-table thead tr {
      background: #003366;
      color: #ffffff;
    }

    .cp-table th {
      padding: 0.28rem 0.5rem;
      text-align: left;
      font-weight: 600;
    }

    .cp-table td {
      padding: 0.28rem 0.5rem;
      border-bottom: 1px solid #dde3ec;
    }

    .cp-table tbody tr:nth-child(even) td {
      background: #f4f7fb;
    }

    /* ── Firma ─────────────────────────────────────────────── */
    .cp-signature {
      display: flex;
      justify-content: center;
      margin-top: 3rem;
    }

    .cp-sig-block {
      text-align: center;
      min-width: 240px;
    }

    .cp-sig-space {
      height: 2.8rem;
    }

    .cp-sig-line {
      border-top: 1px solid #1a1a1a;
      margin-bottom: 0.3rem;
    }

    .cp-sig-name {
      font-weight: 700;
      font-size: 9pt;
      margin: 0;
    }

    .cp-sig-cargo {
      font-size: 8pt;
      color: #555;
      margin: 0.15rem 0 0;
    }

    /* ── Regla @page (controla márgenes del navegador/SO) ──── */
    @page {
      size: letter portrait;
      margin: 1.1cm 1.5cm;
    }

    /* ── Overrides en impresión ─────────────────────────────── */
    @media print {
      .cert-print {
        padding: 0 !important;
        max-width: none !important;
      }
    }
  `,
})
export class PrintCertificacion {
  readonly certificacion = input.required<CertificacionDetalle>();
  readonly observaciones = input<ObservacionDetalle[]>([]);
  readonly modificaciones = input<ModificacionDetalle[]>([]);
  readonly modo = input<'vista' | 'impresion'>('impresion');
}
