import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Dependencia,
  UnidadConDependencia,
} from '../../../core/models';
import { UnidadService } from '../../../core/services/unidad.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-unidades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Unidades Organizacionales</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nueva Unidad</button>
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
            @for (u of unidades(); track u.id) {
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
              <tr><td colspan="5" style="text-align: center; padding: 2rem">No hay unidades registradas.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()" role="dialog" aria-modal="true" aria-label="Formulario de unidad">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editandoId() ? 'Editar' : 'Nueva' }} Unidad</h3>
            <button class="btn-icon" (click)="cerrarModal()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="codigo" class="form-label">Código *</label>
                <input id="codigo" type="number" formControlName="codigo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="unidad" class="form-label">Nombre *</label>
                <input id="unidad" type="text" formControlName="unidad" class="form-input" />
              </div>
              <div class="form-group">
                <label for="id_dependencia" class="form-label">Dependencia *</label>
                <select id="id_dependencia" formControlName="id_dependencia" class="form-input">
                  <option value="">— Seleccionar —</option>
                  @for (d of dependencias(); track d.id) {
                    <option [value]="d.id">{{ d.codigo }} — {{ d.dependencia }}</option>
                  }
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="form.invalid || guardando()">
                  {{ guardando() ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
  `,
})
export class Unidades implements OnInit {
  private readonly svc = inject(UnidadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly unidades = signal<UnidadConDependencia[]>([]);
  protected readonly dependencias = signal<Dependencia[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    codigo: [0, Validators.required],
    unidad: ['', Validators.required],
    id_dependencia: ['', Validators.required],
  });

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
