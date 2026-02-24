import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dependencia } from '../../../core/models';
import { UnidadService } from '../../../core/services/unidad.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-dependencias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Dependencias</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nueva Dependencia</button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Dependencias">
          <thead>
            <tr>
              <th>Código</th>
              <th>Dependencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (d of dependencias(); track d.id) {
              <tr>
                <td>{{ d.codigo }}</td>
                <td>{{ d.dependencia }}</td>
                <td>
                  <span class="badge" [class.badge-active]="d.activo" [class.badge-inactive]="!d.activo">
                    {{ d.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(d)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(d)">
                    {{ d.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" style="text-align: center; padding: 2rem">No hay dependencias registradas.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()" role="dialog" aria-modal="true" aria-label="Formulario de dependencia">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editandoId() ? 'Editar' : 'Nueva' }} Dependencia</h3>
            <button class="btn-icon" (click)="cerrarModal()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="codigo" class="form-label">Código *</label>
                <input id="codigo" type="text" formControlName="codigo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="dependencia" class="form-label">Nombre *</label>
                <input id="dependencia" type="text" formControlName="dependencia" class="form-input" />
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
export class Dependencias implements OnInit {
  private readonly svc = inject(UnidadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly dependencias = signal<Dependencia[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    dependencia: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.dependencias.set(await this.svc.listarDependencias());
    } catch {
      this.toast.error('Error al cargar dependencias');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ codigo: '', dependencia: '' });
    this.modalAbierto.set(true);
  }

  protected editar(d: Dependencia): void {
    this.editandoId.set(d.id);
    this.form.patchValue({ codigo: d.codigo, dependencia: d.dependencia });
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
        await this.svc.editarDependencia(this.editandoId()!, val);
        this.toast.success('Dependencia actualizada');
      } else {
        await this.svc.crearDependencia(val);
        this.toast.success('Dependencia creada');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(d: Dependencia): Promise<void> {
    try {
      await this.svc.editarDependencia(d.id, { activo: !d.activo });
      this.toast.success(d.activo ? 'Dependencia desactivada' : 'Dependencia activada');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
