import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import {
  ReporteCompleto,
  ReportePorUnidad,
  ReportePorProyecto,
  ReporteCuentaJerarquico,
  DetalleUnidadPorCuenta,
  DetalleCuentaPorUnidad,
} from '../../core/models';
import { ReporteService } from '../../core/services/reporte.service';
import { ToastService } from '../../core/services/toast.service';
import { Combobox, ComboboxOption } from '../../shared/components/combobox/combobox';

interface CuentaReporteNode {
  data: ReporteCuentaJerarquico;
  children: CuentaReporteNode[];
  depth: number;
  aggCertificaciones: number;
  aggMonto: number;
}

type ModalKind = 'unidad' | 'cuenta' | null;

@Component({
  selector: 'app-reportes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, Combobox],
  template: `
    <!-- -- Filters ------------------------------------------- -->
    <div class="card filters-card">
      <div class="card-header">
        <h2>Reportes de Certificaciones Presupuestarias</h2>
      </div>
      <div class="card-body">
        <form [formGroup]="filtros" (ngSubmit)="cargar()">
          <div class="filters-grid">
            <div class="form-group">
              <label for="anio-select">Año</label>
              <app-combobox
                formControlName="anio"
                [options]="anioOptions"
                placeholder="Todos los años"
                ariaLabel="Filtrar por año"
              />
            </div>
            <div class="form-group">
              <label>Mes</label>
              <app-combobox
                formControlName="mes"
                [options]="mesOptions"
                placeholder="Todos los meses"
                ariaLabel="Filtrar por mes"
              />
            </div>
            <div class="form-group">
              <label for="f-desde">Fecha desde</label>
              <input id="f-desde" type="date" formControlName="fecha_desde" />
            </div>
            <div class="form-group">
              <label for="f-hasta">Fecha hasta</label>
              <input id="f-hasta" type="date" formControlName="fecha_hasta" />
            </div>
            <div class="filter-action">
              <button type="submit" class="btn btn-primary" [disabled]="loading()">
                @if (loading()) {
                  <span class="btn-spinner" aria-hidden="true"></span> Cargando...
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Generar
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    @if (reporte(); as r) {
      <!-- -- Summary cards ------------------------------------ -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-value">{{ r.resumen.total_certificaciones }}</div>
          <div class="summary-label">Total Certificaciones</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">Bs {{ (r.resumen.monto_total ?? '0') | number:'1.2-2' }}</div>
          <div class="summary-label">Monto Total</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ r.por_unidad.length }}</div>
          <div class="summary-label">Unidades</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ r.por_cuenta_jerarquico.length }}</div>
          <div class="summary-label">Cuentas</div>
        </div>
      </div>

      <!-- -- Por Unidad -------------------------------------- -->
      <div class="card section-card">
        <div class="card-header section-header">
          <h3>Por Unidad Organizacional</h3>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" (click)="exportarTablaUnidad()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button class="btn btn-secondary btn-sm" (click)="imprimirTabla('tabla-unidad', 'Por Unidad Organizacional')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
          </div>
        </div>
        <div class="card-body table-wrap" id="tabla-unidad">
          <table class="data-table" aria-label="Reporte por unidad">
            <thead>
              <tr>
                <th>Código</th>
                <th>Unidad</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
                <th style="text-align:center;width:60px">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (u of r.por_unidad; track u.unidad_id) {
                <tr>
                  <td>{{ u.unidad_codigo }}</td>
                  <td>{{ u.unidad_nombre }}</td>
                  <td style="text-align:right">{{ u.total_certificaciones }}</td>
                  <td style="text-align:right">{{ (u.monto_total ?? '0') | number:'1.2-2' }}</td>
                  <td style="text-align:center">
                    <button
                      class="btn-icon"
                      title="Ver detalle por cuenta contable"
                      aria-label="Ver detalle de {{ u.unidad_nombre }}"
                      (click)="abrirDetalleUnidad(u)"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-cell">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- -- Por Cuenta (Jerárquico) ------------------------- -->
      <div class="card section-card">
        <div class="card-header section-header">
          <h3>Por Cuenta Contable (Jerárquico)</h3>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" (click)="expandirTodoCuentas()">Expandir todo</button>
            <button class="btn btn-secondary btn-sm" (click)="colapsarTodoCuentas()">Colapsar todo</button>
            <button class="btn btn-secondary btn-sm" (click)="exportarTablaCuenta()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button class="btn btn-secondary btn-sm" (click)="imprimirTabla('tabla-cuenta', 'Por Cuenta Contable')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
          </div>
        </div>
        <div class="card-body table-wrap" id="tabla-cuenta">
          <table class="data-table" aria-label="Reporte jerárquico por cuenta">
            <thead>
              <tr>
                <th style="min-width:350px">Código / Cuenta</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
                <th style="text-align:center;width:60px">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visibleCuentaRows(); track row.data.cuenta_id) {
                <tr [style.background]="row.depth === 0 ? 'var(--color-ucb-gray-50)' : ''"
                    [style.font-weight]="row.data.nivel < 5 ? '600' : '400'">
                  <td>
                    <div class="cuenta-cell" [style.padding-left.rem]="row.depth * 1.5">
                      @if (row.children.length > 0) {
                        <button
                          class="btn-icon expand-btn"
                          (click)="toggleExpandCuenta(row.data.cuenta_id)"
                          [attr.aria-label]="expandedCuentaIds().has(row.data.cuenta_id) ? 'Colapsar' : 'Expandir'"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            @if (expandedCuentaIds().has(row.data.cuenta_id)) {
                              <polyline points="6 9 12 15 18 9"/>
                            } @else {
                              <polyline points="9 6 15 12 9 18"/>
                            }
                          </svg>
                        </button>
                      } @else {
                        <span class="expand-spacer"></span>
                      }
                      <span>
                        <span class="cuenta-codigo">{{ row.data.cuenta_codigo }}</span>
                        <span class="cuenta-nombre">{{ row.data.cuenta_nombre }}</span>
                      </span>
                    </div>
                  </td>
                  <td style="text-align:right">{{ row.aggCertificaciones }}</td>
                  <td style="text-align:right">{{ row.aggMonto | number:'1.2-2' }}</td>
                  <td style="text-align:center">
                    @if (row.data.nivel === 5) {
                      <button
                        class="btn-icon"
                        title="Ver detalle por unidad organizacional"
                        aria-label="Ver detalle de {{ row.data.cuenta_nombre }}"
                        (click)="abrirDetalleCuenta(row.data)"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="empty-cell">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- -- Por Proyecto ------------------------------------- -->
      <div class="card section-card">
        <div class="card-header section-header">
          <h3>Por Proyecto</h3>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" (click)="exportarTablaProyecto()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Excel
            </button>
            <button class="btn btn-secondary btn-sm" (click)="imprimirTabla('tabla-proyecto', 'Por Proyecto')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
          </div>
        </div>
        <div class="card-body table-wrap" id="tabla-proyecto">
          <table class="data-table" aria-label="Reporte por proyecto">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              @for (p of r.por_proyecto; track p.proyecto_nombre) {
                <tr>
                  <td>{{ p.proyecto_nombre }}</td>
                  <td style="text-align:right">{{ p.total_certificaciones }}</td>
                  <td style="text-align:right">{{ (p.monto_total ?? '0') | number:'1.2-2' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="empty-cell">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- -- Modal: Detalle Unidad ---------------------------- -->
    @if (modalKind() === 'unidad') {
      <div class="modal-backdrop" role="dialog" aria-modal="true" [attr.aria-label]="'Detalle de ' + modalTitle()" (click)="cerrarModal()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Detalle por Cuenta Contable</h3>
              <p class="modal-subtitle">{{ modalTitle() }}</p>
            </div>
            <div class="modal-header-actions">
              <button class="btn btn-secondary btn-sm" (click)="exportarModalUnidad()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
              <button class="btn btn-secondary btn-sm" (click)="imprimirModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
              <button class="btn-icon modal-close" aria-label="Cerrar" (click)="cerrarModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="modal-body" id="modal-print-area">
            @if (modalLoading()) {
              <div class="modal-loading" aria-live="polite">Cargando...</div>
            } @else {
              <table class="data-table" aria-label="Detalle por cuenta contable">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta Contable</th>
                    <th style="text-align:right">Certificaciones</th>
                    <th style="text-align:right">Monto Total (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of detalleUnidad(); track d.cuenta_codigo) {
                    <tr>
                      <td>{{ d.cuenta_codigo }}</td>
                      <td>{{ d.cuenta_nombre }}</td>
                      <td style="text-align:right">{{ d.total_certificaciones }}</td>
                      <td style="text-align:right">{{ (d.monto_total ?? '0') | number:'1.2-2' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="empty-cell">Sin datos para este filtro</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }

    <!-- -- Modal: Detalle Cuenta ---------------------------- -->
    @if (modalKind() === 'cuenta') {
      <div class="modal-backdrop" role="dialog" aria-modal="true" [attr.aria-label]="'Detalle de ' + modalTitle()" (click)="cerrarModal()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Detalle por Unidad Organizacional</h3>
              <p class="modal-subtitle">{{ modalTitle() }}</p>
            </div>
            <div class="modal-header-actions">
              <button class="btn btn-secondary btn-sm" (click)="exportarModalCuenta()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
              <button class="btn btn-secondary btn-sm" (click)="imprimirModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
              <button class="btn-icon modal-close" aria-label="Cerrar" (click)="cerrarModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="modal-body" id="modal-print-area">
            @if (modalLoading()) {
              <div class="modal-loading" aria-live="polite">Cargando...</div>
            } @else {
              <table class="data-table" aria-label="Detalle por unidad organizacional">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Unidad Organizacional</th>
                    <th style="text-align:right">Certificaciones</th>
                    <th style="text-align:right">Monto Total (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of detalleCuenta(); track d.unidad_codigo) {
                    <tr>
                      <td>{{ d.unidad_codigo }}</td>
                      <td>{{ d.unidad_nombre }}</td>
                      <td style="text-align:right">{{ d.total_certificaciones }}</td>
                      <td style="text-align:right">{{ (d.monto_total ?? '0') | number:'1.2-2' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="empty-cell">Sin datos para este filtro</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    /* -- Filter card -- */
    .filters-card { margin-bottom: 1.5rem }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      align-items: end;
    }

    .filter-action { display: flex; align-items: flex-end }
    .filter-action .btn { width: 100%; justify-content: center; gap: 0.4rem }

    .btn-spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg) } }

    /* -- Summary cards -- */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,.1);
      border-left: 4px solid var(--color-ucb-primary);
    }
    .summary-value { font-size: 1.6rem; font-weight: 700; color: var(--color-ucb-primary) }
    .summary-label { font-size: 0.85rem; color: var(--color-gray-500); margin-top: 0.25rem }

    /* -- Section cards -- */
    .section-card { margin-bottom: 1.5rem }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .section-header h3 { margin: 0 }

    .header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center }

    .table-wrap { padding: 0; overflow-x: auto }

    .empty-cell { text-align: center; padding: 1rem; color: var(--color-gray-500) }

    /* -- Cuenta tree cell -- */
    .cuenta-cell { display: flex; align-items: center }
    .expand-btn { padding: 0.125rem; margin-right: 0.25rem }
    .expand-spacer { display: inline-block; width: 22px }
    .cuenta-codigo { color: var(--color-ucb-primary) }
    .cuenta-nombre { margin-left: 0.5rem }

    /* -- Modal -- */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-panel {
      background: white;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.22);
      width: 100%;
      max-width: 760px;
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--color-gray-200, #e5e7eb);
      flex-shrink: 0;
    }
    .modal-header-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0 }
    .modal-title { margin: 0; font-size: 1.05rem; font-weight: 600 }
    .modal-subtitle { margin: 0.2rem 0 0; font-size: 0.875rem; color: var(--color-gray-500) }
    .modal-close { padding: 0.25rem }
    .modal-body { overflow-y: auto; flex: 1 }
    .modal-loading { padding: 2rem; text-align: center; color: var(--color-gray-500) }
  `,
})
export class Reportes implements OnInit {
  private readonly reporteSvc = inject(ReporteService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly reporte = signal<ReporteCompleto | null>(null);
  protected readonly loading = signal(false);
  protected readonly expandedCuentaIds = signal<Set<string>>(new Set());

  // Modal state
  protected readonly modalKind = signal<ModalKind>(null);
  protected readonly modalTitle = signal('');
  protected readonly modalLoading = signal(false);
  protected readonly detalleUnidad = signal<DetalleUnidadPorCuenta[]>([]);
  protected readonly detalleCuenta = signal<DetalleCuentaPorUnidad[]>([]);

  private currentFiltros: Record<string, unknown> = {};

  protected readonly filtros = this.fb.group({
    mes: [null as number | null],
    anio: [null as number | null],
    fecha_desde: [''],
    fecha_hasta: [''],
  });

  protected readonly mesOptions: ComboboxOption[] = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  protected readonly anioOptions: ComboboxOption[] = (() => {
    const currentYear = 2026;
    const years = [];
    for (let y = currentYear; y <= currentYear + 10; y++) {
      years.push({ value: y, label: String(y) });
    }
    return years;
  })();

  // Build hierarchical tree
  private readonly cuentaTree = computed<CuentaReporteNode[]>(() => {
    const r = this.reporte();
    if (!r) return [];
    const items = r.por_cuenta_jerarquico ?? [];
    const map = new Map<string, CuentaReporteNode>();
    for (const item of items) {
      map.set(item.cuenta_id, {
        data: item,
        children: [],
        depth: 0,
        aggCertificaciones: item.total_certificaciones,
        aggMonto: Number(item.monto_total) || 0,
      });
    }
    const roots: CuentaReporteNode[] = [];
    for (const node of map.values()) {
      const parentId = node.data.id_cuenta_padre;
      if (parentId && map.has(parentId)) {
        map.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const aggregate = (nodes: CuentaReporteNode[], depth: number): void => {
      for (const n of nodes) {
        n.depth = depth;
        if (n.children.length > 0) {
          aggregate(n.children, depth + 1);
          n.aggCertificaciones = n.children.reduce((s, c) => s + c.aggCertificaciones, 0);
          n.aggMonto = n.children.reduce((s, c) => s + c.aggMonto, 0);
        }
      }
    };
    aggregate(roots, 0);
    return roots;
  });

  protected readonly visibleCuentaRows = computed<CuentaReporteNode[]>(() => {
    const expanded = this.expandedCuentaIds();
    const result: CuentaReporteNode[] = [];
    const walk = (nodes: CuentaReporteNode[]) => {
      for (const n of nodes) {
        result.push(n);
        if (n.children.length > 0 && expanded.has(n.data.cuenta_id)) {
          walk(n.children);
        }
      }
    };
    walk(this.cuentaTree());
    return result;
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      const val = this.filtros.getRawValue();
      const filtros: Record<string, unknown> = {};
      if (val.mes != null) filtros['mes'] = val.mes;
      if (val.anio != null) filtros['anio'] = val.anio;
      if (val.fecha_desde) filtros['fecha_desde'] = val.fecha_desde;
      if (val.fecha_hasta) filtros['fecha_hasta'] = val.fecha_hasta;
      this.currentFiltros = filtros;

      const result = await this.reporteSvc.obtener(
        Object.keys(filtros).length > 0 ? (filtros as never) : undefined,
      );
      this.reporte.set(result);
      const ids = new Set<string>();
      for (const item of result.por_cuenta_jerarquico ?? []) {
        if (item.nivel <= 2) ids.add(item.cuenta_id);
      }
      this.expandedCuentaIds.set(ids);
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleExpandCuenta(id: string): void {
    const s = new Set(this.expandedCuentaIds());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.expandedCuentaIds.set(s);
  }

  protected expandirTodoCuentas(): void {
    const ids = new Set<string>();
    for (const item of (this.reporte()?.por_cuenta_jerarquico ?? [])) ids.add(item.cuenta_id);
    this.expandedCuentaIds.set(ids);
  }

  protected colapsarTodoCuentas(): void {
    this.expandedCuentaIds.set(new Set());
  }

  // -- Modal openers ------------------------------------------

  protected async abrirDetalleUnidad(u: ReportePorUnidad): Promise<void> {
    this.modalKind.set('unidad');
    this.modalTitle.set(`${u.unidad_codigo}  -  ${u.unidad_nombre}`);
    this.modalLoading.set(true);
    this.detalleUnidad.set([]);
    try {
      const data = await this.reporteSvc.detalleUnidad(
        u.unidad_id,
        Object.keys(this.currentFiltros).length > 0 ? (this.currentFiltros as never) : undefined,
      );
      this.detalleUnidad.set(data);
    } catch (err) {
      this.toast.error(String(err));
      this.modalKind.set(null);
    } finally {
      this.modalLoading.set(false);
    }
  }

  protected async abrirDetalleCuenta(cuenta: ReporteCuentaJerarquico): Promise<void> {
    this.modalKind.set('cuenta');
    this.modalTitle.set(`${cuenta.cuenta_codigo}  -  ${cuenta.cuenta_nombre}`);
    this.modalLoading.set(true);
    this.detalleCuenta.set([]);
    try {
      const data = await this.reporteSvc.detalleCuenta(
        cuenta.cuenta_id,
        Object.keys(this.currentFiltros).length > 0 ? (this.currentFiltros as never) : undefined,
      );
      this.detalleCuenta.set(data);
    } catch (err) {
      this.toast.error(String(err));
      this.modalKind.set(null);
    } finally {
      this.modalLoading.set(false);
    }
  }

  protected cerrarModal(): void {
    this.modalKind.set(null);
  }

  // -- Per-table Excel exports --------------------------------

  protected async exportarTablaUnidad(): Promise<void> {
    const r = this.reporte();
    if (!r) return;
    try {
      const XLSX = await import('xlsx');
      const data = r.por_unidad.map((u: ReportePorUnidad) => ({
        Codigo: u.unidad_codigo,
        Unidad: u.unidad_nombre,
        Certificaciones: u.total_certificaciones,
        'Monto Total (Bs)': u.monto_total ?? '0',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Por Unidad');
      XLSX.writeFile(wb, `reporte_por_unidad_${this.isoDate()}.xlsx`);
      this.toast.success('Exportado correctamente');
    } catch { this.toast.error('Error al exportar'); }
  }

  protected async exportarTablaCuenta(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const data = this.flattenTree(this.cuentaTree()).map(n => ({
        Codigo: n.data.cuenta_codigo,
        Cuenta: '  '.repeat(n.depth) + n.data.cuenta_nombre,
        Nivel: n.data.nivel,
        Certificaciones: n.aggCertificaciones,
        'Monto Total (Bs)': n.aggMonto,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Por Cuenta');
      XLSX.writeFile(wb, `reporte_por_cuenta_${this.isoDate()}.xlsx`);
      this.toast.success('Exportado correctamente');
    } catch { this.toast.error('Error al exportar'); }
  }

  protected async exportarTablaProyecto(): Promise<void> {
    const r = this.reporte();
    if (!r) return;
    try {
      const XLSX = await import('xlsx');
      const data = r.por_proyecto.map((p: ReportePorProyecto) => ({
        Proyecto: p.proyecto_nombre,
        Certificaciones: p.total_certificaciones,
        'Monto Total (Bs)': p.monto_total ?? '0',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Por Proyecto');
      XLSX.writeFile(wb, `reporte_por_proyecto_${this.isoDate()}.xlsx`);
      this.toast.success('Exportado correctamente');
    } catch { this.toast.error('Error al exportar'); }
  }

  protected async exportarModalUnidad(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const data = this.detalleUnidad().map(d => ({
        Codigo: d.cuenta_codigo,
        'Cuenta Contable': d.cuenta_nombre,
        Certificaciones: d.total_certificaciones,
        'Monto Total (Bs)': d.monto_total ?? '0',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
      XLSX.writeFile(wb, `detalle_unidad_${this.isoDate()}.xlsx`);
      this.toast.success('Exportado correctamente');
    } catch { this.toast.error('Error al exportar'); }
  }

  protected async exportarModalCuenta(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const data = this.detalleCuenta().map(d => ({
        Codigo: d.unidad_codigo,
        'Unidad Organizacional': d.unidad_nombre,
        Certificaciones: d.total_certificaciones,
        'Monto Total (Bs)': d.monto_total ?? '0',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
      XLSX.writeFile(wb, `detalle_cuenta_${this.isoDate()}.xlsx`);
      this.toast.success('Exportado correctamente');
    } catch { this.toast.error('Error al exportar'); }
  }

  // -- Per-table print ----------------------------------------

  protected imprimirTabla(elementId: string, titulo: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${titulo}</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; padding: 1rem }
        h2 { margin-bottom: 0.5rem }
        table { width: 100%; border-collapse: collapse }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left }
        th { background: #f3f4f6; font-weight: 600 }
        td:last-child, th:last-child { display: none }
      </style></head><body>
      <h2>${titulo}</h2>${el.innerHTML}</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=600');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  protected imprimirModal(): void {
    const el = document.getElementById('modal-print-area');
    if (!el) return;
    const titulo = this.modalTitle();
    const subtitulo = this.modalKind() === 'unidad' ? 'Detalle por Cuenta Contable' : 'Detalle por Unidad Organizacional';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${subtitulo}  -  ${titulo}</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; padding: 1rem }
        h2, h3 { margin: 0 0 0.25rem }
        p { margin: 0 0 0.75rem; color: #555 }
        table { width: 100%; border-collapse: collapse }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left }
        th { background: #f3f4f6; font-weight: 600 }
      </style></head><body>
      <h2>${subtitulo}</h2><p>${titulo}</p>${el.innerHTML}</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=600');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  // -- Helpers ------------------------------------------------

  private flattenTree(nodes: CuentaReporteNode[], result: CuentaReporteNode[] = []): CuentaReporteNode[] {
    for (const n of nodes) {
      result.push(n);
      if (n.children.length > 0) this.flattenTree(n.children, result);
    }
    return result;
  }

  private isoDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
