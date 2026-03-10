import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CertificacionService } from '../../core/services/certificacion.service';
import { UnidadService } from '../../core/services/unidad.service';
import { CuentaService } from '../../core/services/cuenta.service';
import { ProyectoService } from '../../core/services/proyecto.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { ToastService } from '../../core/services/toast.service';
import { SyncService } from '../../core/services/sync.service';
import { ModificacionService } from '../../core/services/modificacion.service';
import { CertificacionDetalle, FiltrosCertificacion, UnidadConDependencia, CuentaContableDetalle, Proyecto, UsuarioConPerfil, ModificacionDetalle } from '../../core/models';
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
          <div class="filter-item filter-search">
            <label for="f-busqueda">Buscar</label>
            <input
              id="f-busqueda"
              type="search"
              formControlName="busqueda"
              placeholder="Nro. certificación o concepto..."
            />
          </div>
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
          
          <div class="filter-item filter-actions">
            <button class="btn btn-secondary btn-sm" (click)="clearFilters()">
              Limpiar filtros
            </button>
          </div>
          <div class="filter-item filter-anuladas">
            <label class="toggle-label">
              <input
                type="checkbox"
                formControlName="mostrar_anuladas"
                (change)="onMostrarAnuladasChange()"
              />
              Mostrar anuladas
            </label>
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
            @for (cert of paginatedCerts(); track cert.id) {
              <tr [class.row-anulada]="cert.deleted_at">
                <td>
                  <span class="badge badge-primary">{{ cert.nro_certificacion }}/{{ cert.anio_certificacion }}</span>
                  @if (cert.deleted_at) {
                    <span class="badge badge-anulada" style="margin-left: 0.25rem">ANULADA</span>
                  }
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
                    @if (!cert.deleted_at && canEditCert(cert)) {
                      <button class="btn-icon" title="Editar" (click)="editarCert(cert)" aria-label="Editar certificación">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    }
                    @if (!cert.deleted_at) {
                      <button class="btn-icon" title="Imprimir" (click)="imprimirCert(cert)" aria-label="Imprimir certificación">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="6 9 6 2 18 2 18 9"/>
                          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                      </button>
                    }
                    @if (!cert.deleted_at && canAnularCert(cert)) {
                      <button class="btn-icon btn-icon--danger" title="Anular certificación" (click)="iniciarAnular(cert)" aria-label="Anular certificación">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                      </button>
                    }
                    @if (cert.deleted_at && canAnularCert(cert)) {
                      <button class="btn-icon btn-icon--reactivar" title="Reactivar certificación" (click)="reactivarCert(cert)" aria-label="Reactivar certificación">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 .49-4.93"/>
                        </svg>
                      </button>
                    }
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

    <!-- Pagination -->
    @if (totalPages() > 1) {
      <div class="pagination no-print">
        <button
          class="pagination-btn"
          [disabled]="currentPage() === 1"
          (click)="currentPage.set(currentPage() - 1)"
          aria-label="Página anterior"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        @for (p of pageNumbers(); track $index) {
          @if (p === '...') {
            <span class="pagination-ellipsis">…</span>
          } @else {
            <button
              class="pagination-btn"
              [class.pagination-btn--active]="p === currentPage()"
              [attr.aria-label]="'Página ' + p"
              [attr.aria-current]="p === currentPage() ? 'page' : null"
              (click)="currentPage.set(+p)"
            >{{ p }}</button>
          }
        }
        <button
          class="pagination-btn"
          [disabled]="currentPage() === totalPages()"
          (click)="currentPage.set(currentPage() + 1)"
          aria-label="Página siguiente"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <span class="pagination-info">Página {{ currentPage() }} de {{ totalPages() }} &middot; {{ certificaciones().length }} resultados</span>
      </div>
    }

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
        <app-print-certificacion [certificacion]="printCert()!" [modificaciones]="printModificaciones()" [modo]="'impresion'" />
      </div>
    }

    <!-- Modal: confirmar anulación -->
    @if (anularTargetCert()) {
      <div class="anular-backdrop" role="dialog" aria-modal="true" aria-labelledby="anular-modal-title">
        <div class="anular-box">
          <div class="anular-header">
            <h3 id="anular-modal-title">Anular Certificación</h3>
            <button type="button" class="btn-icon" (click)="cancelarAnular()" aria-label="Cerrar" [disabled]="anulando()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p style="font-size: 0.875rem; color: var(--color-ucb-gray-600); margin: 0.25rem 0 0.75rem">
            Está a punto de anular la certificación
            <strong>{{ anularTargetCert()!.nro_certificacion }}/{{ anularTargetCert()!.anio_certificacion }}</strong>
            — "<em>{{ anularTargetCert()!.concepto }}</em>".
            Esta acción es irreversible.
          </p>
          <p style="font-size: 0.875rem; margin: 0 0 0.75rem">
            Para confirmar, escriba <strong style="color: var(--color-danger, #dc2626)">AUTORIZO</strong>:
          </p>
          <div class="form-group">
            <input
              id="anular-confirm-input"
              type="text"
              [value]="anularInput()"
              (input)="anularInput.set($any($event.target).value)"
              placeholder="Escriba AUTORIZO..."
              autocomplete="off"
              [attr.aria-describedby]="'anular-modal-title'"
            />
          </div>
          <div class="anular-actions">
            <button type="button" class="btn btn-secondary" (click)="cancelarAnular()" [disabled]="anulando()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-danger"
              [disabled]="anularInput() !== 'AUTORIZO' || anulando()"
              (click)="confirmarAnular()"
            >
              @if (anulando()) { Anulando... } @else { Anular Certificación }
            </button>
          </div>
        </div>
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
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 1rem 0 0.25rem;
      flex-wrap: wrap;
    }
    .pagination-btn {
      min-width: 2rem;
      height: 2rem;
      padding: 0 0.5rem;
      border: 1px solid var(--color-ucb-gray-200, #e5e7eb);
      border-radius: 0.375rem;
      background: #fff;
      cursor: pointer;
      font-size: 0.875rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--color-ucb-gray-700, #374151);
      transition: background 0.15s, border-color 0.15s;
    }
    .pagination-btn:hover:not(:disabled) { background: var(--color-ucb-gray-50, #f9fafb); border-color: var(--color-ucb-gray-400, #9ca3af); }
    .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination-btn--active { background: var(--color-primary, #2563eb); color: #fff; border-color: var(--color-primary, #2563eb); font-weight: 600; }
    .pagination-ellipsis { padding: 0 0.25rem; color: var(--color-ucb-gray-400, #9ca3af); }
    .pagination-info { font-size: 0.8125rem; color: var(--color-ucb-gray-500, #6b7280); margin-left: 0.5rem; }

    /* Anuladas */
    .row-anulada td { opacity: 0.6; }
    .badge-anulada {
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.65rem;
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      font-weight: 700;
      vertical-align: middle;
    }
    .btn-icon--danger { color: #dc2626; }
    .btn-icon--danger:hover { color: #991b1b; background: #fee2e2; }
    .btn-icon--reactivar { color: #16a34a; }
    .btn-icon--reactivar:hover { color: #15803d; background: #dcfce7; }
    .filter-anuladas {
      display: flex;
      align-items: flex-end;
    }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8125rem;
      cursor: pointer;
      user-select: none;
    }
    .toggle-label input[type="checkbox"] { cursor: pointer; }

    /* Anular confirmation modal */
    .anular-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .anular-box {
      background: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      width: min(480px, 92vw);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }
    .anular-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    .anular-header h3 {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      color: #b91c1c;
    }
    .anular-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
    }
    .btn-danger {
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly syncService = inject(SyncService);
  private readonly modService = inject(ModificacionService);

  protected readonly certificaciones = signal<CertificacionDetalle[]>([]);
  protected readonly unidades = signal<UnidadConDependencia[]>([]);
  protected readonly cuentas = signal<CuentaContableDetalle[]>([]);
  protected readonly proyectos = signal<Proyecto[]>([]);
  protected readonly usuarios = signal<UsuarioConPerfil[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedCert = signal<CertificacionDetalle | null>(null);
  protected readonly printCert = signal<CertificacionDetalle | null>(null);
  protected readonly printModificaciones = signal<ModificacionDetalle[]>([]);

  // Anular
  protected readonly anularTargetCert = signal<CertificacionDetalle | null>(null);
  protected readonly anularInput = signal('');
  protected readonly anulando = signal(false);
  protected readonly mostrandoAnuladas = signal(false);

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 20;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.certificaciones().length / this.pageSize))
  );
  protected readonly paginatedCerts = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.certificaciones().slice(start, start + this.pageSize);
  });
  protected readonly pageNumbers = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (cur > 3) pages.push('...');
    const lo = Math.max(2, cur - 1);
    const hi = Math.min(total - 1, cur + 1);
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    if (total > 1) pages.push(total);
    return pages;
  });

  protected readonly filterForm = this.fb.group({
    id_unidad: [[] as (string | number)[]],
    id_cuenta_contable: [[] as (string | number)[]],
    id_proyecto: [[] as (string | number)[]],
    generado_por: [[] as (string | number)[]],
    fecha_desde: ['' as string],
    fecha_hasta: ['' as string],
    busqueda: ['' as string],
    mostrar_anuladas: [false as boolean],
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
    const sub = this.filterForm.valueChanges.pipe(debounceTime(300)).subscribe((val) => {
      this.mostrandoAnuladas.set(!!val.mostrar_anuladas);
      this.currentPage.set(1);
      void this.applyFilters();
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    // Silently refresh certs when a background sync brings in cloud changes
    const syncSub = this.syncService.syncCompleted$.subscribe(() => void this.applyFilters());
    this.destroyRef.onDestroy(() => syncSub.unsubscribe());

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
      const toStrArr = (v: unknown): string[] =>
        Array.isArray(v) && v.length > 0 ? (v as (string | number)[]).map(String) : [];

      const filtrosLimpios: FiltrosCertificacion = {
        mostrar_anuladas: val.mostrar_anuladas ?? false,
      };
      const unidades = toStrArr(val.id_unidad);
      if (unidades.length) filtrosLimpios.id_unidad = unidades;
      const cuentas = toStrArr(val.id_cuenta_contable);
      if (cuentas.length) filtrosLimpios.id_cuenta_contable = cuentas;
      const proyectos = toStrArr(val.id_proyecto);
      if (proyectos.length) filtrosLimpios.id_proyecto = proyectos;
      const usuarios = toStrArr(val.generado_por);
      if (usuarios.length) filtrosLimpios.generado_por = usuarios;
      if (val.fecha_desde) filtrosLimpios.fecha_desde = val.fecha_desde;
      if (val.fecha_hasta) filtrosLimpios.fecha_hasta = val.fecha_hasta;
      if (val.busqueda?.trim()) filtrosLimpios.busqueda = val.busqueda.trim();

      const certs = await this.certService.listar(filtrosLimpios);
      this.certificaciones.set(certs);
    } catch (error) {
      this.toast.error('Error filtrando: ' + error);
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.filterForm.setValue({
      id_unidad: [],
      id_cuenta_contable: [],
      id_proyecto: [],
      generado_por: [],
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: '',
      mostrar_anuladas: false,
    });
    this.currentPage.set(1);
  }

  protected verDetalle(cert: CertificacionDetalle): void {
    this.selectedCert.set(cert);
  }

  protected canEditCert(cert: CertificacionDetalle): boolean {
    if (!this.auth.canEdit()) return false;
    return cert.generado_por_id === this.auth.userId();
  }

  protected canAnularCert(cert: CertificacionDetalle): boolean {
    return this.auth.isAdmin() || cert.generado_por_id === this.auth.userId();
  }

  protected iniciarAnular(cert: CertificacionDetalle): void {
    this.anularTargetCert.set(cert);
    this.anularInput.set('');
  }

  protected cancelarAnular(): void {
    this.anularTargetCert.set(null);
    this.anularInput.set('');
  }

  protected async confirmarAnular(): Promise<void> {
    if (this.anularInput() !== 'AUTORIZO') return;
    const cert = this.anularTargetCert();
    if (!cert) return;
    this.anulando.set(true);
    try {
      await this.certService.anular(cert.id);
      this.toast.success(`Certificación ${cert.nro_certificacion}/${cert.anio_certificacion} anulada correctamente`);
      this.anularTargetCert.set(null);
      this.anularInput.set('');
      await this.applyFilters();
    } catch (err) {
      this.toast.error('Error al anular: ' + String(err));
    } finally {
      this.anulando.set(false);
    }
  }

  protected async reactivarCert(cert: CertificacionDetalle): Promise<void> {
    try {
      await this.certService.reactivar(cert.id);
      this.toast.success(`Certificación ${cert.nro_certificacion}/${cert.anio_certificacion} reactivada correctamente`);
      await this.applyFilters();
    } catch (err) {
      this.toast.error('Error al reactivar: ' + String(err));
    }
  }

  protected onMostrarAnuladasChange(): void {
    // Immediately update the signal for template (before debounce fires)
    this.mostrandoAnuladas.set(!!this.filterForm.get('mostrar_anuladas')?.value);
  }

  protected editarCert(cert: CertificacionDetalle): void {
    this.router.navigate(['/certificaciones', cert.id, 'editar']);
  }

  protected async imprimirCert(cert: CertificacionDetalle): Promise<void> {
    // Load modification history so it appears on the printed page
    let mods: ModificacionDetalle[] = [];
    try {
      mods = await this.modService.listar(cert.id);
    } catch {
      // Non-critical — print without history if fetch fails
    }
    this.printModificaciones.set(mods);
    this.printCert.set(cert);
    setTimeout(() => {
      window.print();
      this.printCert.set(null);
      this.printModificaciones.set([]);
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
