import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Dependencia,
  UnidadConDependencia,
} from '../../../core/models';
import { UnidadService } from '../../../core/services/unidad.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/components/modal/modal';
import { Combobox, ComboboxOption } from '../../../shared/components/combobox/combobox';

@Component({
  selector: 'app-unidades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Combobox],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Unidades Organizacionales</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nueva Unidad</button>
      </div>
      <div class="card-body" style="padding: 1rem; border-bottom: 1px solid var(--color-ucb-gray-200)">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center">
          <div style="position: relative; flex: 1; min-width: 220px">
            <svg style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--color-ucb-gray-400)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              [value]="busqueda()"
              (input)="setBusqueda($event)"
              style="padding-left: 2rem; width: 100%"
              aria-label="Buscar unidades"
            />
          </div>
          <app-combobox
            [formControl]="filtroDependenciaCtrl"
            [options]="dependenciaFiltroOptions()"
            placeholder="Todas las dependencias"
            ariaLabel="Filtrar por dependencia"
          />
          <app-combobox
            [formControl]="filtroEstadoCtrl"
            [options]="estadoFiltroOptions"
            placeholder="Todos los estados"
            ariaLabel="Filtrar por estado"
          />
          @if (busqueda() || filtroDependencia() || filtroEstado()) {
            <button class="btn btn-secondary btn-sm" (click)="limpiarFiltros()">Limpiar filtros</button>
          }
          <span style="color: var(--color-ucb-gray-500); font-size: 0.85rem; white-space: nowrap">
            {{ unidadesFiltradas().length }} / {{ unidades().length }} unidades
          </span>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Unidades organizacionales">
          <thead>
            <tr>
              <th>Código</th>
              <th>Unidad</th>
              <th>Dependencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (u of unidadesFiltradas(); track u.id) {
              <tr>
                <td>{{ u.codigo }}</td>
                <td>{{ u.unidad }}</td>
                <td>{{ u.dependencia_nombre }}</td>
                <td>
                  <span class="badge" [class.badge-active]="u.activo" [class.badge-inactive]="!u.activo">
                    {{ u.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(u)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(u)">
                    {{ u.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" style="text-align: center; padding: 2rem">{{ busqueda() || filtroDependencia() || filtroEstado() !== 'todos' ? 'No hay unidades que coincidan con los filtros.' : 'No hay unidades registradas.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <app-modal [open]="modalAbierto()" [title]="editandoId() ? 'Editar Unidad' : 'Nueva Unidad'" ariaLabel="Formulario de unidad" (closed)="cerrarModal()">
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-group">
            <label for="codigo">Código *</label>
            <input id="codigo" type="number" formControlName="codigo" />
          </div>
          <div class="form-group">
            <label for="unidad">Nombre *</label>
            <input id="unidad" type="text" formControlName="unidad" />
          </div>
          <div class="form-group">
            <label>Dependencia *</label>
            <app-combobox
              formControlName="id_dependencia"
              [options]="dependenciaOptions()"
              placeholder="— Seleccionar —"
              ariaLabel="Dependencia"
            />
          </div>
        </form>
        <div modalFooter class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cerrarModal()">Cancelar</button>
          <button type="button" class="btn btn-primary" [disabled]="form.invalid || guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: ``,
})
export class Unidades implements OnInit {
  private readonly svc = inject(UnidadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly unidades = signal<UnidadConDependencia[]>([]);
  protected readonly dependencias = signal<Dependencia[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtroDependenciaCtrl = new FormControl<string | null>(null);
  protected readonly filtroEstadoCtrl = new FormControl<string | null>(null);
  protected readonly filtroDependencia = toSignal(this.filtroDependenciaCtrl.valueChanges, { initialValue: null });
  protected readonly filtroEstado = toSignal(this.filtroEstadoCtrl.valueChanges, { initialValue: null });
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly dependenciaOptions = computed<ComboboxOption[]>(() =>
    this.dependencias().map(d => ({ value: d.id, label: `${d.codigo} — ${d.dependencia}` }))
  );

  protected readonly dependenciaFiltroOptions = computed<ComboboxOption[]>(() =>
    this.dependencias().map(d => ({ value: d.id, label: `${d.codigo} — ${d.dependencia}` }))
  );

  protected readonly estadoFiltroOptions: ComboboxOption[] = [
    { value: 'activos', label: 'Solo activos' },
    { value: 'inactivos', label: 'Solo inactivos' },
  ];

  protected readonly unidadesFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const dep = this.filtroDependencia();
    const estado = this.filtroEstado();
    return this.unidades().filter(u => {
      if (estado === 'activos' && !u.activo) return false;
      if (estado === 'inactivos' && u.activo) return false;
      if (dep && u.id_dependencia !== dep) return false;
      if (!q) return true;
      return String(u.codigo).includes(q) || u.unidad.toLowerCase().includes(q);
    });
  });

  protected readonly form = this.fb.nonNullable.group({
    codigo: [0, Validators.required],
    unidad: ['', Validators.required],
    id_dependencia: ['', Validators.required],
  });

  protected setBusqueda(e: Event): void {
    this.busqueda.set((e.target as HTMLInputElement).value);
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroDependenciaCtrl.setValue(null);
    this.filtroEstadoCtrl.setValue(null);
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const [unidades, deps] = await Promise.all([
        this.svc.listarUnidades(),
        this.svc.listarDependencias(),
      ]);
      this.unidades.set(unidades);
      this.dependencias.set(deps.filter((d) => d.activo));
    } catch {
      this.toast.error('Error al cargar datos');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ codigo: 0, unidad: '', id_dependencia: '' });
    this.modalAbierto.set(true);
  }

  protected editar(u: UnidadConDependencia): void {
    this.editandoId.set(u.id);
    this.form.patchValue({
      codigo: u.codigo,
      unidad: u.unidad,
      id_dependencia: u.id_dependencia,
    });
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    const val = this.form.getRawValue();
    try {
      if (this.editandoId()) {
        await this.svc.editarUnidad(this.editandoId()!, val);
        this.toast.success('Unidad actualizada');
      } else {
        await this.svc.crearUnidad(val);
        this.toast.success('Unidad creada');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(u: UnidadConDependencia): Promise<void> {
    try {
      await this.svc.editarUnidad(u.id, { activo: !u.activo });
      this.toast.success(u.activo ? 'Unidad desactivada' : 'Unidad activada');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
