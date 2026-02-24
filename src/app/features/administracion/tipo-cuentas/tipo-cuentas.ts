import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TipoCuenta } from '../../../core/models';
import { TipoCuentaService } from '../../../core/services/tipo-cuenta.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-tipo-cuentas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Tipos de Cuenta</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nuevo Tipo</button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Tipos de cuenta">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (t of tipos(); track t.id) {
              <tr>
                <td>{{ t.tipo }}</td>
                <td>
                  <span class="badge" [class.badge-active]="t.activo" [class.badge-inactive]="!t.activo">
                    {{ t.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(t)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(t)">
                    {{ t.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" style="text-align: center; padding: 2rem">No hay tipos de cuenta registrados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()" role="dialog" aria-modal="true" aria-label="Formulario de tipo de cuenta">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editandoId() ? 'Editar' : 'Nuevo' }} Tipo de Cuenta</h3>
            <button class="btn-icon" (click)="cerrarModal()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="tipo" class="form-label">Nombre del Tipo *</label>
                <input id="tipo" type="text" formControlName="tipo" class="form-input" />
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
export class TipoCuentas implements OnInit {
  private readonly svc = inject(TipoCuentaService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly tipos = signal<TipoCuenta[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    tipo: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.tipos.set(await this.svc.listar());
    } catch {
      this.toast.error('Error al cargar tipos de cuenta');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ tipo: '' });
    this.modalAbierto.set(true);
  }

  protected editar(t: TipoCuenta): void {
    this.editandoId.set(t.id);
    this.form.patchValue({ tipo: t.tipo });
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
        await this.svc.editar(this.editandoId()!, val);
        this.toast.success('Tipo de cuenta actualizado');
      } else {
        await this.svc.crear(val);
        this.toast.success('Tipo de cuenta creado');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(t: TipoCuenta): Promise<void> {
    try {
      await this.svc.editar(t.id, { activo: !t.activo });
      this.toast.success(t.activo ? 'Tipo desactivado' : 'Tipo activado');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
