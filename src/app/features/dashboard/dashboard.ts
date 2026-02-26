import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CertificacionService } from '../../core/services/certificacion.service';
import { UnidadService } from '../../core/services/unidad.service';
import { CuentaService } from '../../core/services/cuenta.service';
import { ProyectoService } from '../../core/services/proyecto.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { ToastService } from '../../core/services/toast.service';
import { CertificacionDetalle, FiltrosCertificacion, UnidadConDependencia, CuentaContableDetalle, Proyecto, UsuarioConPerfil } from '../../core/models';
import { DetalleCertificacion } from './detalle-certificacion/detalle-certificacion';
import { PrintCertificacion } from '../../shared/components/print-certificacion/print-certificacion';
import { Combobox, ComboboxOption } from '../../shared/components/combobox/combobox';
import { Datepicker } from '../../shared/components/datepicker/datepicker';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DetalleCertificacion, PrintCertificacion, Combobox, Datepicker],
  template: `
    <div class="page-header no-print">
      <h1 class="page-title">Panel de Control</h1>
      <p class="text-muted" style="font-size: 0.8125rem; margin: 0.25rem 0 0">
        Certificaciones presupuestarias emitidas
      </p>
    </div>

    <!-- Filters -->
    <div class="card mb-4 no-print">
      <div class="card-body">
        <div class="filters-grid" [formGroup]="filterForm">
          <div class="filter-item">
            <label>Unidad Organizacional</label>
            <app-combobox
              [multiple]="true"
              formControlName="id_unidad"
              [options]="unidadOptions()"
              placeholder="Todas"
              ariaLabel="Filtrar por unidad"
            />
          </div>
          <div class="filter-item">
            <label>Cuenta Contable</label>
            <app-combobox
              [multiple]="true"
              formControlName="id_cuenta_contable"
              [options]="cuentaOptions()"
              placeholder="Todas"
              ariaLabel="Filtrar por cuenta"
            />
          </div>
          <div class="filter-item">
            <label>Proyecto</label>
            <app-combobox
              [multiple]="true"
              formControlName="id_proyecto"
              [options]="proyectoOptions()"
              placeholder="Todos"
              ariaLabel="Filtrar por proyecto"
            />
          </div>
          <div class="filter-item">
            <label>Generado por</label>
            <app-combobox
              [multiple]="true"
              formControlName="generado_por"
              [options]="usuarioOptions()"
              placeholder="Todos"
              ariaLabel="Filtrar por usuario"
            />
          </div>
          <div class="filter-item">
            <label>Fecha desde</label>
            <app-datepicker
              formControlName="fecha_desde"
              placeholder="Desde"
              ariaLabel="Fecha desde"
            />
          </div>
          <div class="filter-item">
            <label>Fecha hasta</label>
            <app-datepicker
              formControlName="fecha_hasta"
              placeholder="Hasta"
              ariaLabel="Fecha hasta"
            />
          </div>
          <div class="filter-item filter-search">
            <label for="f-busqueda">Buscar</label>
            <input
              id="f-busqueda"
              type="search"
              formControlName="busqueda"
              placeholder="Nro. certificación o concepto..."
            />
          </div>
          <div class="filter-item filter-actions">
            <button class="btn btn-secondary btn-sm" (click)="clearFilters()">
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card no-print">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <span>Certificaciones ({{ certificaciones().length }})</span>
        @if (auth.canEdit()) {
          <button class="btn btn-primary btn-sm" (click)="nuevaCertificacion()">
            + Nueva Certificación
          </button>
        }
      </div>
      <div style="overflow-x: auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nro.</th>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Unidad Org.</th>
              <th>Cuenta Contable</th>
              <th>Importe (Bs)</th>
              <th>Generado por</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (cert of certificaciones(); track cert.id) {
              <tr>
                <td>
                  <span class="badge badge-primary">{{ cert.nro_certificacion }}/{{ cert.anio_certificacion }}</span>
                </td>
                <td style="white-space: nowrap">{{ formatDate(cert.fecha_certificacion) }}</td>
                <td style="max-width: 250px" class="text-truncate">{{ cert.concepto }}</td>
                <td>{{ cert.unidad_nombre }}</td>
                <td>{{ cert.cuenta_nombre }}</td>
                <td style="text-align: right; font-weight: 600">{{ formatMoney(cert.monto_total) }}</td>
                <td>{{ cert.generado_por_nombre }}</td>
                <td>
                  <div style="display: flex; gap: 0.25rem">
                    <button class="btn-icon" title="Ver detalle" (click)="verDetalle(cert)" aria-label="Ver detalle">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    @if (canEditCert(cert)) {
                      <button class="btn-icon" title="Editar" (click)="editarCert(cert)" aria-label="Editar certificación">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    }
                    <button class="btn-icon" title="Imprimir" (click)="imprimirCert(cert)" aria-label="Imprimir certificación">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--color-ucb-gray-500)">
                  @if (loading()) {
                    Cargando certificaciones...
                  } @else {
                    No se encontraron certificaciones
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail modal -->
    @if (selectedCert()) {
      <app-detalle-certificacion
        [certificacion]="selectedCert()!"
        (cerrar)="selectedCert.set(null)"
      />
    }

    <!-- Print area (hidden on screen, visible only for print from table) -->
    @if (printCert()) {
      <div class="print-area">
        <app-print-certificacion [certificacion]="printCert()!" [modo]="'impresion'" />
      </div>
    }
  `,
  styles: [`
    .page-header {
      margin-bottom: 1.25rem;
    }
    .page-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--color-ucb-gray-900);
      margin: 0;
    }
    .mb-4 { margin-bottom: 1rem; }
    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      align-items: end;
    }
    .filter-search { grid-column: span 2; }
    .filter-actions {
      display: flex;
      align-items: flex-end;
    }
  `],
})
export class Dashboard implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly certService = inject(CertificacionService);
  private readonly unidadService = inject(UnidadService);
  private readonly cuentaService = inject(CuentaService);
  private readonly proyectoService = inject(ProyectoService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly certificaciones = signal<CertificacionDetalle[]>([]);
  protected readonly unidades = signal<UnidadConDependencia[]>([]);
  protected readonly cuentas = signal<CuentaContableDetalle[]>([]);
  protected readonly proyectos = signal<Proyecto[]>([]);
  protected readonly usuarios = signal<UsuarioConPerfil[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedCert = signal<CertificacionDetalle | null>(null);
  protected readonly printCert = signal<CertificacionDetalle | null>(null);

  protected readonly filterForm = this.fb.group({
    id_unidad: [''],
    id_cuenta_contable: [''],
    id_proyecto: [''],
    generado_por: [''],
    fecha_desde: [''],
    fecha_hasta: [''],
    busqueda: [''],
  });

  protected readonly unidadOptions = computed<ComboboxOption[]>(() =>
    this.unidades().map(u => ({ value: u.id, label: `${u.codigo} - ${u.unidad}` }))
  );

  protected readonly cuentaOptions = computed<ComboboxOption[]>(() =>
    this.cuentas().filter(c => c.nivel === 5).map(c => ({ value: c.id, label: `${c.codigo} - ${c.cuenta}` }))
  );

  protected readonly proyectoOptions = computed<ComboboxOption[]>(() =>
    this.proyectos().map(p => ({ value: p.id, label: p.nombre }))
  );

  protected readonly usuarioOptions = computed<ComboboxOption[]>(() =>
    this.usuarios().map(u => ({ value: u.id, label: u.nombre_completo }))
  );

  async ngOnInit(): Promise<void> {
    // Subscribe to filter changes for auto-apply
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [certs, unidades, cuentas, proyectos, usuarios] = await Promise.all([
        this.certService.listar(),
        this.unidadService.listarUnidades(),
        this.cuentaService.listar(),
        this.proyectoService.listar(),
        this.usuarioService.listarSimple(),
      ]);
      this.certificaciones.set(certs);
      this.unidades.set(unidades);
      this.cuentas.set(cuentas);
      this.proyectos.set(proyectos);
      this.usuarios.set(usuarios);
    } catch (error) {
      this.toast.error('Error cargando datos: ' + error);
    } finally {
      this.loading.set(false);
    }
  }

  protected async applyFilters(): Promise<void> {
    this.loading.set(true);
    try {
      const val = this.filterForm.getRawValue();
      const filtrosLimpios: FiltrosCertificacion = {};
      if (val.id_unidad) filtrosLimpios.id_unidad = val.id_unidad;
      if (val.id_cuenta_contable) filtrosLimpios.id_cuenta_contable = val.id_cuenta_contable;
      if (val.id_proyecto) filtrosLimpios.id_proyecto = val.id_proyecto;
      if (val.generado_por) filtrosLimpios.generado_por = val.generado_por;
      if (val.fecha_desde) filtrosLimpios.fecha_desde = val.fecha_desde;
      if (val.fecha_hasta) filtrosLimpios.fecha_hasta = val.fecha_hasta;
      if (val.busqueda) filtrosLimpios.busqueda = val.busqueda;

      const certs = await this.certService.listar(
        Object.keys(filtrosLimpios).length > 0 ? filtrosLimpios : undefined,
      );
      this.certificaciones.set(certs);
    } catch (error) {
      this.toast.error('Error filtrando: ' + error);
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.filterForm.reset();
    this.applyFilters();
  }

  protected verDetalle(cert: CertificacionDetalle): void {
    this.selectedCert.set(cert);
  }

  protected canEditCert(cert: CertificacionDetalle): boolean {
    if (!this.auth.canEdit()) return false;
    if (this.auth.isAdmin()) return true;
    return cert.generado_por_id === this.auth.userId();
  }

  protected editarCert(cert: CertificacionDetalle): void {
    this.router.navigate(['/certificaciones', cert.id, 'editar']);
  }

  protected imprimirCert(cert: CertificacionDetalle): void {
    this.printCert.set(cert);
    setTimeout(() => {
      window.print();
      this.printCert.set(null);
    }, 200);
  }

  protected nuevaCertificacion(): void {
    this.router.navigate(['/certificaciones/nueva']);
  }

  protected formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  protected formatMoney(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
