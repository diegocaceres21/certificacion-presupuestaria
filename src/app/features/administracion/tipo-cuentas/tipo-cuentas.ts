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
import { Modal } from '../../../shared/components/modal/modal';

@Component({
  selector: 'app-tipo-cuentas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal],
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
      <app-modal [open]="modalAbierto()" [title]="editandoId() ? 'Editar Tipo de Cuenta' : 'Nuevo Tipo de Cuenta'" ariaLabel="Formulario de tipo de cuenta" (closed)="cerrarModal()">
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-group">
            <label for="tipo">Nombre del Tipo *</label>
            <input id="tipo" type="text" formControlName="tipo" />
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
