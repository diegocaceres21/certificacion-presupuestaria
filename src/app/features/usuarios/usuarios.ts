import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { UsuarioConPerfil } from '../../core/models';
import { UsuarioService } from '../../core/services/usuario.service';
import { ToastService } from '../../core/services/toast.service';
import { Modal } from '../../shared/components/modal/modal';
import { Combobox, ComboboxOption } from '../../shared/components/combobox/combobox';

@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TitleCasePipe, Modal, Combobox],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Gestión de Usuarios</h2>
        <button class="btn btn-primary" (click)="abrirCrear()">+ Nuevo Usuario</button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Usuarios del sistema">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre Completo</th>
              <th>Cargo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (u of usuarios(); track u.id) {
              <tr>
                <td>{{ u.usuario }}</td>
                <td>{{ u.nombre_completo }}</td>
                <td>{{ u.cargo }}</td>
                <td>
                  <span class="badge" [class.badge-admin]="u.rol === 'administrador'"
                        [class.badge-enc]="u.rol === 'encargado'"
                        [class.badge-lec]="u.rol === 'lector'">
                    {{ u.rol | titlecase }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge-active]="u.activo" [class.badge-inactive]="!u.activo">
                    {{ u.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td style="white-space: nowrap">
                  <button class="btn btn-sm" (click)="abrirEditar(u)">Editar</button>
                  <button class="btn btn-sm" (click)="abrirResetPassword(u)">Reset Password</button>
                  <button class="btn btn-sm" (click)="toggleActivo(u)">
                    {{ u.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align: center; padding: 2rem">No hay usuarios registrados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Crear -->
    @if (modalCrear()) {
      <app-modal [open]="modalCrear()" title="Nuevo Usuario" ariaLabel="Crear usuario" (closed)="cerrarModales()">
        <form [formGroup]="crearForm" (ngSubmit)="crear()">
          <div class="form-group">
            <label for="c_usuario">Usuario *</label>
            <input id="c_usuario" type="text" formControlName="usuario" autocomplete="off" />
          </div>
          <div class="form-group">
            <label for="c_password">Contraseña *</label>
            <input id="c_password" type="password" formControlName="password" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label for="c_nombre">Nombre Completo *</label>
            <input id="c_nombre" type="text" formControlName="nombre_completo" />
          </div>
          <div class="form-group">
            <label for="c_cargo">Cargo *</label>
            <input id="c_cargo" type="text" formControlName="cargo" />
          </div>
          <div class="form-group">
            <label for="c_rol">Rol *</label>
            <app-combobox formControlName="rol" [options]="rolOptions" placeholder="Seleccionar rol" ariaLabel="Rol del usuario" />
          </div>
        </form>
        <div modalFooter class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
          <button type="button" class="btn btn-primary" [disabled]="crearForm.invalid || guardando()" (click)="crear()">
            {{ guardando() ? 'Creando...' : 'Crear Usuario' }}
          </button>
        </div>
      </app-modal>
    }

    <!-- Modal Editar -->
    @if (modalEditar()) {
      <app-modal [open]="modalEditar()" title="Editar Usuario" ariaLabel="Editar usuario" (closed)="cerrarModales()">
        <form [formGroup]="editarForm" (ngSubmit)="editar()">
          <div class="form-group">
            <label for="e_nombre">Nombre Completo *</label>
            <input id="e_nombre" type="text" formControlName="nombre_completo" />
          </div>
          <div class="form-group">
            <label for="e_cargo">Cargo *</label>
            <input id="e_cargo" type="text" formControlName="cargo" />
          </div>
          <div class="form-group">
            <label for="e_rol">Rol *</label>
            <app-combobox formControlName="rol" [options]="rolOptions" placeholder="Seleccionar rol" ariaLabel="Rol del usuario" />
          </div>
        </form>
        <div modalFooter class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
          <button type="button" class="btn btn-primary" [disabled]="editarForm.invalid || guardando()" (click)="editar()">
            {{ guardando() ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </app-modal>
    }

    <!-- Modal Reset Password -->
    @if (modalReset()) {
      <app-modal [open]="modalReset()" title="Resetear Contraseña" ariaLabel="Resetear contraseña" (closed)="cerrarModales()">
        <p style="margin-bottom: 1rem">Usuario: <strong>{{ resetUsuario()?.usuario }}</strong></p>
        <form [formGroup]="resetForm" (ngSubmit)="resetPassword()">
          <div class="form-group">
            <label for="r_password">Nueva Contraseña *</label>
            <input id="r_password" type="password" formControlName="password" autocomplete="new-password" />
          </div>
        </form>
        <div modalFooter class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
          <button type="button" class="btn btn-primary" [disabled]="resetForm.invalid || guardando()" (click)="resetPassword()">
            {{ guardando() ? 'Reseteando...' : 'Resetear' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .badge-admin { background: #dbeafe; color: #1e40af; }
    .badge-enc { background: #fef3c7; color: #92400e; }
    .badge-lec { background: #f3f4f6; color: #374151; }
  `,
})
export class Usuarios implements OnInit {
  private readonly svc = inject(UsuarioService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly usuarios = signal<UsuarioConPerfil[]>([]);
  protected readonly modalCrear = signal(false);
  protected readonly modalEditar = signal(false);
  protected readonly modalReset = signal(false);
  protected readonly guardando = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly resetUsuario = signal<UsuarioConPerfil | null>(null);

  protected readonly rolOptions: ComboboxOption[] = [
    { value: 'administrador', label: 'Administrador' },
    { value: 'encargado', label: 'Encargado' },
    { value: 'lector', label: 'Lector' },
  ];

  protected readonly crearForm = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    nombre_completo: ['', Validators.required],
    cargo: ['', Validators.required],
    rol: ['', Validators.required],
  });

  protected readonly editarForm = this.fb.nonNullable.group({
    nombre_completo: ['', Validators.required],
    cargo: ['', Validators.required],
    rol: ['', Validators.required],
  });

  protected readonly resetForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.usuarios.set(await this.svc.listar());
    } catch (err) {
      this.toast.error(String(err));
    }
  }

  protected abrirCrear(): void {
    this.crearForm.reset({ usuario: '', password: '', nombre_completo: '', cargo: '', rol: '' });
    this.modalCrear.set(true);
  }

  protected abrirEditar(u: UsuarioConPerfil): void {
    this.editandoId.set(u.id);
    this.editarForm.patchValue({
      nombre_completo: u.nombre_completo,
      cargo: u.cargo,
      rol: u.rol,
    });
    this.modalEditar.set(true);
  }

  protected abrirResetPassword(u: UsuarioConPerfil): void {
    this.resetUsuario.set(u);
    this.resetForm.reset({ password: '' });
    this.modalReset.set(true);
  }

  protected cerrarModales(): void {
    this.modalCrear.set(false);
    this.modalEditar.set(false);
    this.modalReset.set(false);
  }

  protected async crear(): Promise<void> {
    if (this.crearForm.invalid) return;
    this.guardando.set(true);
    try {
      await this.svc.crear(this.crearForm.getRawValue());
      this.toast.success('Usuario creado correctamente');
      this.cerrarModales();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async editar(): Promise<void> {
    if (this.editarForm.invalid || !this.editandoId()) return;
    this.guardando.set(true);
    try {
      await this.svc.editar(this.editandoId()!, this.editarForm.getRawValue());
      this.toast.success('Usuario actualizado');
      this.cerrarModales();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async resetPassword(): Promise<void> {
    if (this.resetForm.invalid || !this.resetUsuario()) return;
    this.guardando.set(true);
    try {
      await this.svc.resetearPassword(this.resetUsuario()!.id, this.resetForm.getRawValue().password);
      this.toast.success('Contraseña reseteada correctamente');
      this.cerrarModales();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(u: UsuarioConPerfil): Promise<void> {
    try {
      await this.svc.editar(u.id, { activo: !u.activo });
      this.toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
