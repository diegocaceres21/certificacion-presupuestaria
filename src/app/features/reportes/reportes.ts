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
  ReportePorCuenta,
  ReportePorProyecto,
} from '../../core/models';
import { ReporteService } from '../../core/services/reporte.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-reportes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe],
  template: `
    <div class="card" style="margin-bottom: 1.5rem">
      <div class="card-header">
        <h2>Reportes de Certificaciones Presupuestarias</h2>
      </div>
      <div class="card-body">
        <form [formGroup]="filtros" (ngSubmit)="cargar()" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end">
          <div class="form-group" style="flex: 1; min-width: 150px">
            <label for="mes" class="form-label">Mes</label>
            <select id="mes" formControlName="mes" class="form-input">
              <option [ngValue]="null">Todos</option>
              @for (m of meses; track m.valor) {
                <option [ngValue]="m.valor">{{ m.nombre }}</option>
              }
            </select>
          </div>
          <div class="form-group" style="flex: 1; min-width: 120px">
            <label for="anio" class="form-label">Año</label>
            <input id="anio" type="number" formControlName="anio" class="form-input" min="2020" />
          </div>
          <div class="form-group" style="flex: 1; min-width: 150px">
            <label for="fecha_desde" class="form-label">Desde</label>
            <input id="fecha_desde" type="date" formControlName="fecha_desde" class="form-input" />
          </div>
          <div class="form-group" style="flex: 1; min-width: 150px">
            <label for="fecha_hasta" class="form-label">Hasta</label>
            <input id="fecha_hasta" type="date" formControlName="fecha_hasta" class="form-input" />
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
          <div class="summary-value">{{ r.por_cuenta.length }}</div>
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

      <!-- Por Cuenta -->
      <div class="card" style="margin-bottom: 1.5rem">
        <div class="card-header"><h3>Por Cuenta Contable</h3></div>
        <div class="card-body" style="padding:0">
          <table class="data-table" aria-label="Reporte por cuenta">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cuenta</th>
                <th style="text-align:right">Certificaciones</th>
                <th style="text-align:right">Monto Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              @for (c of r.por_cuenta; track c.cuenta_codigo) {
                <tr>
                  <td>{{ c.cuenta_codigo }}</td>
                  <td>{{ c.cuenta_nombre }}</td>
                  <td style="text-align:right">{{ c.total_certificaciones }}</td>
                  <td style="text-align:right">{{ (c.monto_total ?? '0') | number:'1.2-2' }}</td>
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

  protected readonly filtros = this.fb.group({
    mes: [null as number | null],
    anio: [null as number | null],
    fecha_desde: [''],
    fecha_hasta: [''],
  });

  protected readonly meses = [
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
  ];

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
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.loading.set(false);
    }
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

      // Por Cuenta
      const cuentaData = r.por_cuenta.map((c: ReportePorCuenta) => ({
        Código: c.cuenta_codigo,
        Cuenta: c.cuenta_nombre,
        Certificaciones: c.total_certificaciones,
        'Monto Total': c.monto_total ?? '0',
      }));
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
