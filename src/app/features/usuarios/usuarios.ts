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

@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TitleCasePipe],
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
      <div class="modal-overlay" (click)="cerrarModales()" role="dialog" aria-modal="true" aria-label="Crear usuario">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo Usuario</h3>
            <button class="btn-icon" (click)="cerrarModales()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="crearForm" (ngSubmit)="crear()">
              <div class="form-group">
                <label for="c_usuario" class="form-label">Usuario *</label>
                <input id="c_usuario" type="text" formControlName="usuario" class="form-input" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="c_password" class="form-label">Contraseña *</label>
                <input id="c_password" type="password" formControlName="password" class="form-input" autocomplete="new-password" />
              </div>
              <div class="form-group">
                <label for="c_nombre" class="form-label">Nombre Completo *</label>
                <input id="c_nombre" type="text" formControlName="nombre_completo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="c_cargo" class="form-label">Cargo *</label>
                <input id="c_cargo" type="text" formControlName="cargo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="c_rol" class="form-label">Rol *</label>
                <select id="c_rol" formControlName="rol" class="form-input">
                  <option value="">— Seleccionar —</option>
                  <option value="administrador">Administrador</option>
                  <option value="encargado">Encargado</option>
                  <option value="lector">Lector</option>
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="crearForm.invalid || guardando()">
                  {{ guardando() ? 'Creando...' : 'Crear Usuario' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- Modal Editar -->
    @if (modalEditar()) {
      <div class="modal-overlay" (click)="cerrarModales()" role="dialog" aria-modal="true" aria-label="Editar usuario">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Editar Usuario</h3>
            <button class="btn-icon" (click)="cerrarModales()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="editarForm" (ngSubmit)="editar()">
              <div class="form-group">
                <label for="e_nombre" class="form-label">Nombre Completo *</label>
                <input id="e_nombre" type="text" formControlName="nombre_completo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="e_cargo" class="form-label">Cargo *</label>
                <input id="e_cargo" type="text" formControlName="cargo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="e_rol" class="form-label">Rol *</label>
                <select id="e_rol" formControlName="rol" class="form-input">
                  <option value="administrador">Administrador</option>
                  <option value="encargado">Encargado</option>
                  <option value="lector">Lector</option>
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="editarForm.invalid || guardando()">
                  {{ guardando() ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- Modal Reset Password -->
    @if (modalReset()) {
      <div class="modal-overlay" (click)="cerrarModales()" role="dialog" aria-modal="true" aria-label="Resetear contraseña">
        <div class="modal-content" style="max-width: 450px" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Resetear Contraseña</h3>
            <button class="btn-icon" (click)="cerrarModales()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1rem">Usuario: <strong>{{ resetUsuario()?.usuario }}</strong></p>
            <form [formGroup]="resetForm" (ngSubmit)="resetPassword()">
              <div class="form-group">
                <label for="r_password" class="form-label">Nueva Contraseña *</label>
                <input id="r_password" type="password" formControlName="password" class="form-input" autocomplete="new-password" />
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cerrarModales()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="resetForm.invalid || guardando()">
                  {{ guardando() ? 'Reseteando...' : 'Resetear' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .badge {
      padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600;
      display: inline-block;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
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
