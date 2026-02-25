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
import { Modal } from '../../../shared/components/modal/modal';

@Component({
  selector: 'app-dependencias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal],
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
      <app-modal [open]="modalAbierto()" [title]="editandoId() ? 'Editar Dependencia' : 'Nueva Dependencia'" ariaLabel="Formulario de dependencia" (closed)="cerrarModal()">
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-group">
            <label for="codigo">Código *</label>
            <input id="codigo" type="text" formControlName="codigo" />
          </div>
          <div class="form-group">
            <label for="dependencia">Nombre *</label>
            <input id="dependencia" type="text" formControlName="dependencia" />
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
