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
} from '../../core/models';
import { ReporteService } from '../../core/services/reporte.service';
import { ToastService } from '../../core/services/toast.service';
import { Combobox, ComboboxOption } from '../../shared/components/combobox/combobox';
import { Datepicker } from '../../shared/components/datepicker/datepicker';

interface CuentaReporteNode {
  data: ReporteCuentaJerarquico;
  children: CuentaReporteNode[];
  depth: number;
  /** Aggregated total_certificaciones including children */
  aggCertificaciones: number;
  /** Aggregated monto_total including children */
  aggMonto: number;
}

@Component({
  selector: 'app-reportes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, Combobox, Datepicker],
  template: `
    <div class="card" style="margin-bottom: 1.5rem">
      <div class="card-header">
        <h2>Reportes de Certificaciones Presupuestarias</h2>
      </div>
      <div class="card-body">
        <form [formGroup]="filtros" (ngSubmit)="cargar()" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end">
          <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0">
            <label>Mes</label>
            <app-combobox
              formControlName="mes"
              [options]="mesOptions"
              placeholder="Todos"
              ariaLabel="Filtrar por mes"
            />
          </div>
          <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0">
            <label for="anio">Año</label>
            <input id="anio" type="number" formControlName="anio" min="2020" />
          </div>
          <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0">
            <label>Desde</label>
            <app-datepicker
              formControlName="fecha_desde"
              placeholder="Desde"
              ariaLabel="Fecha desde"
            />
          </div>
          <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0">
            <label>Hasta</label>
            <app-datepicker
              formControlName="fecha_hasta"
              placeholder="Hasta"
              ariaLabel="Fecha hasta"
            />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="loading()">
            {{ loading() ? 'Cargando...' : 'Generar Reporte' }}
          </button>
          <button type="button" class="btn btn-secondary" (click)="exportarExcel()" [disabled]="!reporte()">
            Exportar Excel
          </button>
          <button type="button" class="btn btn-secondary" (click)="imprimir()" [disabled]="!reporte()">
            Imprimir
          </button>
        </form>
      </div>
    </div>

    @if (reporte(); as r) {
      <!-- Resumen -->
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

      <!-- Por Unidad -->
      <div class="card" style="margin-bottom: 1.5rem">
        <div class="card-header"><h3>Por Unidad Organizacional</h3></div>
        <div class="card-body" style="padding:0">
          <table class="data-table" aria-label="Reporte por unidad">
            <thead>
              <tr>
                <th>Código</th>
                <th>Unidad</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              @for (u of r.por_unidad; track u.unidad_codigo) {
                <tr>
                  <td>{{ u.unidad_codigo }}</td>
                  <td>{{ u.unidad_nombre }}</td>
                  <td style="text-align:right">{{ u.total_certificaciones }}</td>
                  <td style="text-align:right">{{ (u.monto_total ?? '0') | number:'1.2-2' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" style="text-align:center;padding:1rem">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Por Cuenta (Jerárquico) -->
      <div class="card" style="margin-bottom: 1.5rem">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
          <h3>Por Cuenta Contable (Jerárquico)</h3>
          <div style="display: flex; gap: 0.5rem">
            <button class="btn btn-secondary btn-sm" (click)="expandirTodoCuentas()">Expandir todo</button>
            <button class="btn btn-secondary btn-sm" (click)="colapsarTodoCuentas()">Colapsar todo</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <table class="data-table" aria-label="Reporte jerárquico por cuenta">
            <thead>
              <tr>
                <th style="min-width: 350px">Código / Cuenta</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visibleCuentaRows(); track row.data.cuenta_id) {
                <tr [style.background]="row.depth === 0 ? 'var(--color-ucb-gray-50)' : ''"
                    [style.font-weight]="row.data.nivel < 5 ? '600' : '400'">
                  <td>
                    <div style="display: flex; align-items: center" [style.padding-left.rem]="row.depth * 1.5">
                      @if (row.children.length > 0) {
                        <button
                          class="btn-icon"
                          style="padding: 0.125rem; margin-right: 0.25rem"
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
                        <span style="display: inline-block; width: 22px"></span>
                      }
                      <span>
                        <span style="color: var(--color-ucb-primary)">{{ row.data.cuenta_codigo }}</span>
                        <span style="margin-left: 0.5rem">{{ row.data.cuenta_nombre }}</span>
                      </span>
                    </div>
                  </td>
                  
                  <td style="text-align:right">{{ row.aggCertificaciones }}</td>
                  <td style="text-align:right">{{ row.aggMonto | number:'1.2-2' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" style="text-align:center;padding:1rem">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Por Proyecto -->
      <div class="card">
        <div class="card-header"><h3>Por Proyecto</h3></div>
        <div class="card-body" style="padding:0">
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
                <tr><td colspan="3" style="text-align:center;padding:1rem">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  styles: `
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

    .summary-value {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--color-ucb-primary);
    }

    .summary-label {
      font-size: 0.85rem;
      color: var(--color-gray-500);
      margin-top: 0.25rem;
    }
  `,
})
export class Reportes implements OnInit {
  private readonly reporteSvc = inject(ReporteService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly reporte = signal<ReporteCompleto | null>(null);
  protected readonly loading = signal(false);
  protected readonly expandedCuentaIds = signal<Set<string>>(new Set());

  protected readonly filtros = this.fb.group({
    mes: [null as number | null],
    anio: [null as number | null],
    fecha_desde: [''],
    fecha_hasta: [''],
  });

  protected readonly mesOptions: ComboboxOption[] = [
    { valor: 1, nombre: 'Enero' },
    { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' },
    { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' },
    { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' },
    { valor: 12, nombre: 'Diciembre' },
  ].map(m => ({ value: m.valor, label: m.nombre }));

  // Build hierarchical tree from por_cuenta_jerarquico data
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
    // Set depths and aggregate bottom-up
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

  // Flatten tree respecting expanded state
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

      const result = await this.reporteSvc.obtener(
        Object.keys(filtros).length > 0 ? (filtros as never) : undefined,
      );
      this.reporte.set(result);
      // Auto-expand first 2 levels in tree
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
    for (const item of (this.reporte()?.por_cuenta_jerarquico ?? [])) {
      ids.add(item.cuenta_id);
    }
    this.expandedCuentaIds.set(ids);
  }

  protected colapsarTodoCuentas(): void {
    this.expandedCuentaIds.set(new Set());
  }

  protected async exportarExcel(): Promise<void> {
    const r = this.reporte();
    if (!r) return;

    try {
      const XLSX = await import('xlsx');

      const wb = XLSX.utils.book_new();

      // Resumen
      const resumenData = [
        ['Total Certificaciones', r.resumen.total_certificaciones],
        ['Monto Total (Bs)', r.resumen.monto_total ?? '0'],
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet([['Métrica', 'Valor'], ...resumenData]);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      // Por Unidad
      const unidadData = r.por_unidad.map((u: ReportePorUnidad) => ({
        Código: u.unidad_codigo,
        Unidad: u.unidad_nombre,
        Certificaciones: u.total_certificaciones,
        'Monto Total': u.monto_total ?? '0',
      }));
      const wsUnidad = XLSX.utils.json_to_sheet(unidadData);
      XLSX.utils.book_append_sheet(wb, wsUnidad, 'Por Unidad');

      // Por Cuenta (Jerárquico)
      const flattenTree = (nodes: CuentaReporteNode[], result: { Código: string; Cuenta: string; Nivel: number; Certificaciones: number; 'Monto Total': number }[] = []): typeof result => {
        for (const n of nodes) {
          const indent = '  '.repeat(n.depth);
          result.push({
            Código: n.data.cuenta_codigo,
            Cuenta: `${indent}${n.data.cuenta_nombre}`,
            Nivel: n.data.nivel,
            Certificaciones: n.aggCertificaciones,
            'Monto Total': n.aggMonto,
          });
          if (n.children.length > 0) flattenTree(n.children, result);
        }
        return result;
      };
      const cuentaData = flattenTree(this.cuentaTree());
      const wsCuenta = XLSX.utils.json_to_sheet(cuentaData);
      XLSX.utils.book_append_sheet(wb, wsCuenta, 'Por Cuenta');

      // Por Proyecto
      const proyectoData = r.por_proyecto.map((p: ReportePorProyecto) => ({
        Proyecto: p.proyecto_nombre,
        Certificaciones: p.total_certificaciones,
        'Monto Total': p.monto_total ?? '0',
      }));
      const wsProyecto = XLSX.utils.json_to_sheet(proyectoData);
      XLSX.utils.book_append_sheet(wb, wsProyecto, 'Por Proyecto');

      XLSX.writeFile(wb, `reporte_certificaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
      this.toast.success('Reporte exportado correctamente');
    } catch {
      this.toast.error('Error al exportar a Excel');
    }
  }

  protected imprimir(): void {
    window.print();
  }
}
