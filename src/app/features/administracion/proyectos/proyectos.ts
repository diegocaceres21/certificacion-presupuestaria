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
import { Proyecto } from '../../../core/models';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/components/modal/modal';
import { Combobox, ComboboxOption } from '../../../shared/components/combobox/combobox';

@Component({
  selector: 'app-proyectos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Combobox],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Proyectos</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nuevo Proyecto</button>
      </div>
      <div class="card-body" style="padding: 1rem; border-bottom: 1px solid var(--color-ucb-gray-200)">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center">
          <div style="position: relative; flex: 1; min-width: 220px">
            <svg style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--color-ucb-gray-400)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Buscar por nombre o PEI..."
              [value]="busqueda()"
              (input)="setBusqueda($event)"
              style="padding-left: 2rem; width: 100%"
              aria-label="Buscar proyectos"
            />
          </div>
          <app-combobox
            [formControl]="filtroEstadoCtrl"
            [options]="estadoFiltroOptions"
            placeholder="Todos los estados"
            ariaLabel="Filtrar por estado"
          />
          @if (busqueda() || filtroEstado()) {
            <button class="btn btn-secondary btn-sm" (click)="limpiarFiltros()">Limpiar filtros</button>
          }
          <span style="color: var(--color-ucb-gray-500); font-size: 0.85rem; white-space: nowrap">
            {{ proyectosFiltrados().length }} / {{ proyectos().length }} proyectos
          </span>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Proyectos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>PEI</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (p of proyectosFiltrados(); track p.id) {
              <tr>
                <td>{{ p.nombre }}</td>
                <td>{{ p.descripcion ?? '—' }}</td>
                <td>{{ p.pei ?? '—' }}</td>
                <td>
                  <span class="badge" [class.badge-active]="p.activo" [class.badge-inactive]="!p.activo">
                    {{ p.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(p)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(p)">
                    {{ p.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" style="text-align: center; padding: 2rem">{{ busqueda() || filtroEstado() !== 'todos' ? 'No hay proyectos que coincidan con los filtros.' : 'No hay proyectos registrados.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <app-modal [open]="modalAbierto()" [title]="editandoId() ? 'Editar Proyecto' : 'Nuevo Proyecto'" ariaLabel="Formulario de proyecto" (closed)="cerrarModal()">
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-group">
            <label for="nombre">Nombre *</label>
            <input id="nombre" type="text" formControlName="nombre" />
          </div>
          <div class="form-group">
            <label for="descripcion">Descripción</label>
            <textarea id="descripcion" formControlName="descripcion" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label for="pei">PEI</label>
            <input id="pei" type="text" formControlName="pei" placeholder="Ej: PEI-2024-001" />
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
export class Proyectos implements OnInit {
  private readonly svc = inject(ProyectoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly proyectos = signal<Proyecto[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtroEstadoCtrl = new FormControl<string | null>(null);
  protected readonly filtroEstado = toSignal(this.filtroEstadoCtrl.valueChanges, { initialValue: null });
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly estadoFiltroOptions: ComboboxOption[] = [
    { value: 'activos', label: 'Solo activos' },
    { value: 'inactivos', label: 'Solo inactivos' },
  ];

  protected readonly proyectosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const estado = this.filtroEstado();
    return this.proyectos().filter(p => {
      if (estado === 'activos' && !p.activo) return false;
      if (estado === 'inactivos' && p.activo) return false;
      if (!q) return true;
      return p.nombre.toLowerCase().includes(q)
        || (p.descripcion ?? '').toLowerCase().includes(q)
        || (p.pei ?? '').toLowerCase().includes(q);
    });
  });

  protected setBusqueda(e: Event): void {
    this.busqueda.set((e.target as HTMLInputElement).value);
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroEstadoCtrl.setValue(null);
  }

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    pei: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.proyectos.set(await this.svc.listar());
    } catch {
      this.toast.error('Error al cargar proyectos');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ nombre: '', descripcion: '', pei: '' });
    this.modalAbierto.set(true);
  }

  protected editar(p: Proyecto): void {
    this.editandoId.set(p.id);
    this.form.patchValue({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      pei: p.pei ?? '',
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
        await this.svc.editar(this.editandoId()!, {
          nombre: val.nombre,
          descripcion: val.descripcion || undefined,
          pei: val.pei || undefined,
        });
        this.toast.success('Proyecto actualizado');
      } else {
        await this.svc.crear({
          nombre: val.nombre,
          descripcion: val.descripcion || undefined,
          pei: val.pei || undefined,
        });
        this.toast.success('Proyecto creado');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(p: Proyecto): Promise<void> {
    try {
      await this.svc.editar(p.id, { activo: !p.activo });
      this.toast.success(p.activo ? 'Proyecto desactivado' : 'Proyecto activado');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
