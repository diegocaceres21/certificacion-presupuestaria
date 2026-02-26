import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-perfil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div style="max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">

      <!-- Información del perfil -->
      <div class="card">
        <div class="card-header">
          <h2>Mi Perfil</h2>
          <p style="margin: 0; font-size: 0.875rem; color: var(--color-ucb-gray-500)">
            Rol: <strong>{{ auth.currentUser()?.rol }}</strong>
          </p>
        </div>
        <div class="card-body">
          <form [formGroup]="perfilForm" (ngSubmit)="guardarPerfil()">
            <div class="form-group">
              <label for="p_usuario">Usuario</label>
              <input id="p_usuario" type="text" [value]="auth.currentUser()?.usuario ?? ''" disabled aria-readonly="true" />
              <small style="color: var(--color-ucb-gray-500)">El nombre de usuario no puede modificarse.</small>
            </div>
            <div class="form-group">
              <label for="p_nombre">Nombre Completo *</label>
              <input id="p_nombre" type="text" formControlName="nombre_completo" autocomplete="name" />
            </div>
            <div class="form-group">
              <label for="p_cargo">Cargo *</label>
              <input id="p_cargo" type="text" formControlName="cargo" autocomplete="organization-title" />
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary"
                [disabled]="perfilForm.invalid || guardandoPerfil()">
                {{ guardandoPerfil() ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Cambio de contraseña -->
      <div class="card">
        <div class="card-header">
          <h2>Cambiar Contraseña</h2>
          <p style="margin: 0; font-size: 0.875rem; color: var(--color-ucb-gray-500)">
            Al cambiar la contraseña se cerrará la sesión automáticamente.
          </p>
        </div>
        <div class="card-body">
          <form [formGroup]="passwordForm" (ngSubmit)="cambiarPassword()">
            <div class="form-group">
              <label for="p_pass_actual">Contraseña Actual *</label>
              <input id="p_pass_actual" type="password" formControlName="passwordActual" autocomplete="current-password" />
            </div>
            <div class="form-group">
              <label for="p_pass_nueva">Nueva Contraseña *</label>
              <input id="p_pass_nueva" type="password" formControlName="passwordNueva" autocomplete="new-password" />
              @if (passwordForm.controls.passwordNueva.invalid && passwordForm.controls.passwordNueva.touched) {
                <small style="color: var(--color-danger, #dc2626)">
                  La contraseña debe tener al menos 6 caracteres.
                </small>
              }
            </div>
            <div class="form-group">
              <label for="p_pass_confirmar">Confirmar Nueva Contraseña *</label>
              <input id="p_pass_confirmar" type="password" formControlName="passwordConfirmar" autocomplete="new-password" />
              @if (passwordForm.hasError('mismatch') && passwordForm.controls.passwordConfirmar.touched) {
                <small style="color: var(--color-danger, #dc2626)">
                  Las contraseñas no coinciden.
                </small>
              }
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary"
                [disabled]="passwordForm.invalid || guardandoPassword()">
                {{ guardandoPassword() ? 'Cambiando...' : 'Cambiar Contraseña' }}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `,
})
export class Perfil {
  protected readonly auth = inject(AuthService);
  private readonly svc = inject(UsuarioService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly guardandoPerfil = signal(false);
  protected readonly guardandoPassword = signal(false);

  protected readonly perfilForm = this.fb.nonNullable.group({
    nombre_completo: [this.auth.currentUser()?.nombre_completo ?? '', Validators.required],
    cargo: [this.auth.currentUser()?.cargo ?? '', Validators.required],
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      passwordActual: ['', Validators.required],
      passwordNueva: ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirmar: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  protected async guardarPerfil(): Promise<void> {
    if (this.perfilForm.invalid) return;
    const userId = this.auth.userId();
    if (!userId) return;

    this.guardandoPerfil.set(true);
    try {
      const updated = await this.svc.editarPerfil(userId, this.perfilForm.getRawValue());
      this.auth.actualizarInfoUsuario({
        nombre_completo: updated.nombre_completo,
        cargo: updated.cargo,
      });
      this.toast.success('Perfil actualizado correctamente');
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardandoPerfil.set(false);
    }
  }

  protected async cambiarPassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    const { passwordActual, passwordNueva } = this.passwordForm.getRawValue();
    this.guardandoPassword.set(true);
    try {
      await this.auth.cambiarPassword(passwordActual, passwordNueva);
      this.toast.success('Contraseña cambiada. Inicie sesión nuevamente.');
      this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardandoPassword.set(false);
    }
  }
}

function passwordsMatchValidator(group: import('@angular/forms').AbstractControl) {
  const form = group as import('@angular/forms').FormGroup;
  const nueva = form.get('passwordNueva')?.value ?? '';
  const confirmar = form.get('passwordConfirmar')?.value ?? '';
  return nueva === confirmar ? null : { mismatch: true };
}
